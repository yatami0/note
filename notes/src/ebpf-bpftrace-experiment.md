---
created: 2026-08-19 08:00
updated: 2026-08-19 08:00
---
# bpftraceでカーネルを観測する実験

[[ebpf]]の「アプリを無改変・再起動なしでカーネル側から観測できる」を、実際にbpftraceのワンライナーで体感した記録。

- **目的**: ①eBPFプログラムが本当にロード・実行できるか、②プロセス起動とシステムコールをカーネル側から観測する、③`open().read()`一発の裏で何が起きているかを数える
- **環境**: リモートコンテナ (Ubuntu 24.04系, カーネル 6.18.5-fc-v20, root権限), bpftrace 0.20.2（`apt-get install bpftrace`）

## 躓いた点とその対処

1. **tracefsがマウントされていない** — `bpftrace -l`が`/sys/kernel/tracing/available_events`を読めず、プローブが26個しか見えない。コンテナ環境の定番の躓き。`mount -t tracefs tracefs /sys/kernel/tracing`で解決（プローブが1496個に増えた）
2. **このカーネルには`tracepoint:syscalls:*`が存在しない** — 通常のカーネルにある`sys_enter_openat`等のsyscall個別トレースポイント（CONFIG_FTRACE_SYSCALLS）が無効化されたカスタムカーネルだった。**kprobeも使えない**（`available_filter_functions`が無い）。プローブの可用性はカーネルのビルド構成次第、というのを身をもって確認
   - 代替: 全syscall共通の入口`tracepoint:raw_syscalls:sys_enter`と、`tracepoint:sched:sched_process_exec`は生きていたのでこれで実験を組み直した
3. `RLIMIT_MEMLOCK`の警告が出るが、プログラムのロード自体は成功する（非致命的）

## 実験1: プロセス起動をカーネル側から見る

```
tracepoint:sched:sched_process_exec
{
    printf("%-8d %-16s -> %s\n", pid, comm, str(args->filename));
}
```

これを流しながら別シェルで`ls`・`python3`・`git`・`date`を実行すると:

```
4078     ls               -> /usr/bin/ls
4079     python3          -> /usr/local/bin/python3
4080     git              -> /usr/bin/git
4081     date             -> /usr/bin/date
```

観測対象のプロセスには何も仕込んでいない。execイベントのトレースポイントにプログラムをアタッチしただけで、システム全体のプロセス起動が見える。

## 実験2: システムコールを数える

### (a) 3秒間のプロセス別syscall数

```
tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }
interval:s:3 { exit(); }
```

ファイルI/Oのビジーループを回したpython3が3秒で**270,619回**。集計はカーネル内のBPF maps上で行われ、ユーザー空間に渡るのは終了時の集計結果だけなので、この頻度でもシステムは平然としている（1イベントごとにユーザー空間へ通知していたら破綻する量）。

### (b) `with open(f) as f: f.read()` ×1000回の内訳

`/comm == "python3"/`でフィルタし、syscall番号別にカウント。raw_syscallsは**番号しか取れない**ので、同じ処理を`strace -c`にもかけて名前と突合した:

| syscall (x86_64番号) | 回数 | 1回のopen+readあたり |
|---|---|---|
| openat (257) | 1000 | 1 |
| read (0) | 2000 | **2**（本文＋EOF確認の空読み） |
| fstat (5) | 2000 | 2（バッファサイズ決定等） |
| lseek (8) | 2000 | 2 |
| ioctl (16) | 1000 | 1（**全てエラー**。ENOTTY＝「端末か？」の判定に使われている） |
| close (3) | 1000 | 1 |

Pythonで「ファイルを開いて読む」1回の裏で**約9個のsyscall**が飛んでいる。`read`が2回なのは、要求サイズ未満が返っても終端と断定できず、0バイトが返るまで読むため。`ioctl`が毎回失敗しているのは、バッファリング方式を決めるためのisatty判定で、失敗すること自体が「端末ではない＝ファイルだ」という情報として使われている。

## 読み取れること

- [[ebpf]]の中核価値「**対象を無改変・再起動なしで、本番相当の環境を観測できる**」はワンライナーで体感できる。printfデバッグやアプリ側の計測コードと根本的に違うレイヤー
- ただし**何が観測できるかはカーネル構成に完全に依存する**。コンテナ・マネージド環境では tracefs 未マウント／syscallsトレースポイント無効／kprobe無効が普通にあり、「手元で動いたワンライナーが本番で動かない」は起きる。`bpftrace -l`での確認が最初の一歩
- 集計をカーネル内で完結させるmapsの設計が、低オーバーヘッドの理由（27万イベント/3秒でも平気）
- 副産物として、高級言語の1行がsyscall層でどう見えるかの解像度が上がった。ループ内で毎回`open`するコードのコストが「9 syscalls×N」と数字で見える

## 出典

- [bpftrace: One-Liner Tutorial](https://bpftrace.org/tutorial-one-liners)
- [bpftrace Reference Guide](https://bpftrace.org/docs)
- x86_64のsyscall番号との突合は`strace -c`の出力による

#ebpf #linux #カーネル #実験

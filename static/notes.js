// サイドバーのノート検索 (タイトルの部分一致でフィルタ)
var search = document.getElementById('note-search');
if (search) {
    search.addEventListener('input', function () {
        var q = search.value.toLowerCase();
        document.querySelectorAll('.note-list li').forEach(function (li) {
            li.style.display =
                li.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
    });
}

// テーマ切替: 明示的に選ぶと data-theme + localStorage に保存し、OS設定より優先される
var toggle = document.getElementById('theme-toggle');
if (toggle) {
    toggle.addEventListener('click', function () {
        var root = document.documentElement;
        var current = root.getAttribute('data-theme') ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
    });
}

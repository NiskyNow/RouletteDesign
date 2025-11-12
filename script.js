document.addEventListener("DOMContentLoaded", () => {
    
    // --- 状態管理 ---
    // アプリケーションの全ての状態を保持するオブジェクト
    let settings = {
        colors: {
            bg: "#ffffff",
            base: "#cccccc",
            divider: "#000000",
            wheel: "#aaaaaa",
            wheelLine: "#999999",
            hubBg: "#888888",
            hubBorder: "#777777",
            axis: "#666666",
            segments: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"]
        },
        segmentRadius: 372.5
    };

    // --- DOM要素の取得 ---
    const root = document.documentElement;
    const basicColorsContainer = document.getElementById("basic-colors");
    const segmentColorsContainer = document.getElementById("segment-colors");
    const dividersContainer = document.getElementById("dividers");
    
    // プロファイルUI
    const importBtn = document.getElementById("profile-import");
    const exportBtn = document.getElementById("profile-export");
    const profileIO = document.getElementById("profile-io");

    // レイアウトUI
    const radiusSlider = document.getElementById("radius-slider");
    const radiusValue = document.getElementById("radius-value");

    // --- カラーピッカー生成 ---
    function createColorPickers() {
        // コンテナをクリア
        basicColorsContainer.innerHTML = '';
        segmentColorsContainer.innerHTML = '';

        // 基本色
        for (const key in settings.colors) {
            if (key !== 'segments') {
                const label = document.createElement('label');
                label.htmlFor = `picker-${key}`;
                label.textContent = key;
                
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.id = `picker-${key}`;
                picker.value = settings.colors[key];
                
                picker.addEventListener('input', (e) => {
                    settings.colors[key] = e.target.value;
                    applyColors();
                });
                
                basicColorsContainer.appendChild(label);
                basicColorsContainer.appendChild(picker);
            }
        }

        // セグメント色
        settings.colors.segments.forEach((color, index) => {
            const label = document.createElement('label');
            label.htmlFor = `segment-${index}`;
            label.textContent = `Seg ${index + 1}`;
            
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = `segment-${index}`;
            picker.value = color;
            
            picker.addEventListener('input', (e) => {
                settings.colors.segments[index] = e.target.value;
                applyColors();
            });
            
            segmentColorsContainer.appendChild(label);
            segmentColorsContainer.appendChild(picker);
        });
    }

    // --- 仕切り線生成 ---
    function createDividers() {
        dividersContainer.innerHTML = ''; // クリア
        const segmentCount = settings.colors.segments.length;
        const angleStep = 360 / segmentCount;

        for (let i = 0; i < segmentCount; i++) {
            const angle = angleStep * i;
            const line = document.createElement('div');
            line.className = 'divider-line';
            line.style.transform = `rotate(${angle}deg)`;
            dividersContainer.appendChild(line);
        }
    }

    // --- 描画更新関数 ---

    // 色をCSSカスタムプロパティに適用
    function applyColors() {
        // 基本色
        for (const key in settings.colors) {
            if (key !== 'segments') {
                // CSS変数キーを生成 (例: hubBg -> --hub-bg-color)
                const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-color`;
                root.style.setProperty(cssVar, settings.colors[key]);
            }
        }
        // ホイールの線 (wheelLine -> wheel-line-color)
        root.style.setProperty('--wheel-line-color', settings.colors.wheelLine);

        // セグメント (conic-gradientを生成)
        const segmentCount = settings.colors.segments.length;
        if (segmentCount === 0) {
            root.style.setProperty('--segments-gradient', 'conic-gradient(#fff 0% 100%)');
            return;
        }
        
        const step = 100 / segmentCount;
        let gradientStops = [];
        let currentPos = 0;

        settings.colors.segments.forEach((color, index) => {
            const start = currentPos;
            const end = (index === segmentCount - 1) ? 100 : (currentPos + step);
            gradientStops.push(`${color} ${start}% ${end}%`);
            currentPos = end;
        });

        root.style.setProperty('--segments-gradient', `conic-gradient(${gradientStops.join(', ')})`);
    }

    // 半径をCSSカスタムプロパティに適用
    function applyRadius() {
        settings.segmentRadius = parseFloat(radiusSlider.value);
        radiusValue.textContent = settings.segmentRadius;
        root.style.setProperty('--segment-radius', `${settings.segmentRadius}px`);
    }

    // 全ての描画を更新 (プロファイル読み込み時など)
    function updateAllVisuals() {
        createColorPickers(); // ピッカーを再生成 (セグメント数が変わる可能性があるため)
        createDividers();     // 仕切り線を再生成
        applyColors();
        applyRadius();
        
        // スライダーの値も更新
        radiusSlider.value = settings.segmentRadius;
        radiusValue.textContent = settings.segmentRadius;
    }

    // --- ファイルI/O ロジック ---
    function exportProfile() {
        const name = 'roulette_profile';
        const dataStr = JSON.stringify(settings, null, 2); // 整形したJSON
        
        // テキストエリアにも設定
        profileIO.value = dataStr;

        // ファイルとしてダウンロード
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importProfile() {
        const dataStr = profileIO.value;
        if (!dataStr) {
            alert("テキストエリアにJSONデータを貼り付けてください。");
            return;
        }
        try {
            const importedSettings = JSON.parse(dataStr);
            // TODO: ここで importedSettings の構造が正しいかバリデーションをかけるのが望ましい
            settings = importedSettings;
            updateAllVisuals();
            alert("プロファイルをインポートしました。");
        } catch (e) {
            alert("JSONデータのパースに失敗しました。");
        }
    }

    // --- イベントリスナー登録 ---
    radiusSlider.addEventListener('input', applyRadius);
    exportBtn.addEventListener('click', exportProfile);
    importBtn.addEventListener('click', importProfile);

    // --- 初期化処理 ---
    function init() {
        updateAllVisuals();
    }

    init(); // アプリケーション開始
});
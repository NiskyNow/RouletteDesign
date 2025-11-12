document.addEventListener("DOMContentLoaded", () => {
    
    // --- 状態管理 ---
    // アプリケーションの全ての状態を保持するオブジェクト
    let settings = {
        colors: {
            bg: "#f0f0f0",          // 背景
            base: "#d9d9d9",        // ルーレット土台
            divider: "#333333",     // マスの仕切り線
            wheel: "#fffacd",       // ウィール（クリーム色）
            wheelLine: "#f0e68c",   // ウィールの内側のライン
            hubBg: "#d3d3d3",       // ハブ
            hubBorder: "#a9a9a9",   // ハブの外周
            axis: "#5a5a5a",        // ハブ中心の軸
            segments: ["#ff8c00", "#ffd700", "#32cd32", "#4682b4", "#9370db", "#ff69b4", "#dc143c", "#00ced1", "#ff4500", "#8a2be2"]
        },
        segmentRadius: 372.5
    };

    // 複数プロファイルが読み込まれた際のデータを保持するオブジェクト
    let loadedProfiles = {};

    // --- DOM要素の取得 ---
    const root = document.documentElement;
    const basicColorsContainer = document.getElementById("basic-colors");
    const segmentColorsContainer = document.getElementById("segment-colors");
    const dividersContainer = document.getElementById("dividers");
    
    // プロファイルUI
    const importBtn = document.getElementById("profile-import-btn");
    const exportBtn = document.getElementById("profile-export");
    const profileIO = document.getElementById("profile-io");
    const profileFileInput = document.getElementById("profile-file-input");

    // レイアウトUI
    const radiusSlider = document.getElementById("radius-slider");
    const radiusValue = document.getElementById("radius-value");

    // プロファイル選択UI
    const profileSelector = document.getElementById("profile-selector");

    // --- カラーピッカー生成 ---
    function createColorPickers() {
        // コンテナをクリア
        basicColorsContainer.innerHTML = '';
        segmentColorsContainer.innerHTML = '';

        // 基本色
        for (const key in settings.colors) {
            if (key !== 'segments') {
                // ラベルのテキストを生成 (例: hubBg -> Hub Bg)
                const labelText = key
                    .replace(/([A-Z])/g, ' $1') // 大文字の前にスペース
                    .replace(/^./, (str) => str.toUpperCase()); // 先頭を大文字に

                const label = document.createElement('label');
                label.htmlFor = `picker-${key}`;
                label.textContent = labelText;

                // 補足説明が必要なキー
                const descriptions = {
                    wheel: '（外周）', wheelLine: '（内側ライン）', hubBg: '（ハブ本体）', hubBorder: '（ハブ外周）', axis: '（中心軸）'
                };
                if (descriptions[key]) label.textContent += ` ${descriptions[key]}`;

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
                const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                const cssVar = `--${cssVarName}-color`;
                root.style.setProperty(cssVar, settings.colors[key]);
            }
        }

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
        saveSettingsToLocalStorage(); // 変更を保存
    }

    // 半径をCSSカスタムプロパティに適用
    function applyRadius() {
        settings.segmentRadius = parseFloat(radiusSlider.value);
        radiusValue.textContent = settings.segmentRadius;
        root.style.setProperty('--segment-radius', `${settings.segmentRadius}px`);
        saveSettingsToLocalStorage(); // 変更を保存
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

    // --- プロファイル選択ロジック ---
    function updateProfileSelector() {
        profileSelector.innerHTML = ''; // 既存の選択肢をクリア

        const profileNames = Object.keys(loadedProfiles);

        if (profileNames.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'プロファイルがありません';
            profileSelector.appendChild(option);
            profileSelector.disabled = true;
            return;
        }

        profileNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            profileSelector.appendChild(option);
        });

        profileSelector.disabled = false;
        // 最初のプロファイルを自動で適用
        applyProfile(profileNames[0]);
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
        const file = profileFileInput.files[0];
        if (!file) {
            alert("ファイルが選択されていません。");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dataStr = event.target.result;
                const importedSettings = JSON.parse(dataStr);

                // 形式を判定 (単一設定か、複数プロファイルの集合か)
                if (importedSettings.colors && importedSettings.segmentRadius !== undefined) {
                    // 単一プロファイルの場合
                    loadedProfiles = { 'インポートされた設定': importedSettings };
                    alert("単一のプロファイルをインポートしました。");
                } else {
                    // 複数プロファイルの場合
                    loadedProfiles = importedSettings;
                    alert(`${Object.keys(loadedProfiles).length}件のプロファイルをインポートしました。`);
                }
                
                // 読み込んだ内容をテキストエリアに表示
                profileIO.value = JSON.stringify(loadedProfiles, null, 2);

                // プロファイルセレクターを更新
                updateProfileSelector();

            } catch (e) {
                alert("JSONデータのパースに失敗しました。ファイルが破損しているか、形式が正しくありません。");
                console.error("Import Error:", e);
            }
        };
        reader.onerror = () => {
            alert("ファイルの読み込みに失敗しました。");
        };
        reader.readAsText(file);
    }

    function applyProfile(profileName) {
        if (!loadedProfiles[profileName]) {
            console.error(`Profile "${profileName}" not found.`);
            return;
        }
        // グローバル設定を選択されたプロファイルで上書き
        settings = loadedProfiles[profileName];
        profileSelector.value = profileName; // ドロップダウンの選択状態を更新
        updateAllVisuals(); // 画面全体を更新
        saveSettingsToLocalStorage(); // 変更をlocalStorageに保存
    }

    // --- LocalStorage ロジック ---
    function saveSettingsToLocalStorage() {
        try {
            localStorage.setItem('rouletteSettings', JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save settings to localStorage:", e);
        }
    }

    function loadSettingsFromLocalStorage() {
        const savedSettings = localStorage.getItem('rouletteSettings');
        if (savedSettings) {
            try {
                // 保存された設定でデフォルト値を上書きし、"前回終了時の設定"としてプロファイルリストに追加
                settings = JSON.parse(savedSettings);
                loadedProfiles = {
                    '前回終了時の設定': settings
                };
                // 起動時は、他のプロファイルは読み込まれていないので、これだけをセレクターに表示
                updateProfileSelector();
            } catch (e) {
                console.error("Failed to parse settings from localStorage. Using default settings.", e);
                // パースに失敗した場合は、デフォルト設定を使い、壊れたデータを削除する
                localStorage.removeItem('rouletteSettings');
            }
        }
    }

    // --- イベントリスナー登録 ---
    radiusSlider.addEventListener('input', applyRadius);
    exportBtn.addEventListener('click', exportProfile);
    importBtn.addEventListener('click', () => profileFileInput.click()); // ボタンクリックでファイル選択を開く
    profileFileInput.addEventListener('change', importProfile);
    profileSelector.addEventListener('change', (e) => applyProfile(e.target.value));

    // --- 初期化処理 ---
    function init() {
        loadSettingsFromLocalStorage(); // 起動時に前回の設定を読み込む
        // loadSettingsFromLocalStorageがセレクタ更新と描画更新を行うため、
        // ここでのupdateAllVisuals()呼び出しは不要（重複になる）
        if (Object.keys(loadedProfiles).length === 0) {
            updateAllVisuals(); // localStorageに何もない初回起動時のみ実行
        }
    }

    init(); // アプリケーション開始
});
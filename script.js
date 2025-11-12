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
        segmentRadius: 372.5,
        shadowIntensity: 1.0 // 影の強さ (1.0がデフォルト)
    };

    // 複数プロファイルが読み込まれた際のデータを保持するオブジェクト
    let loadedProfiles = {};
    
    // 現在選択されているプロファイル名を保持
    let currentProfileName = null;

    // --- DOM要素の取得 ---
    const root = document.documentElement;
    const basicColorsContainer = document.getElementById("basic-colors");
    const segmentColorsContainer = document.getElementById("segment-colors");
    const dividersContainer = document.getElementById("dividers");

    // ルーレットパーツ
    const baseEl = document.getElementById('base');
    const segmentsEl = document.getElementById('segments');
    const wheelEl = document.getElementById('wheel');
    const hubEl = document.getElementById('hub');
    const axisEl = document.getElementById('axis');

    // セグメント数UI
    const addSegmentBtn = document.getElementById("add-segment-btn");
    const removeSegmentBtn = document.getElementById("remove-segment-btn");
    const segmentCountDisplay = document.getElementById("segment-count");
    
    // プロファイルUI
    const importBtn = document.getElementById("profile-import-btn");
    const exportBtn = document.getElementById("profile-export");
    const profileIO = document.getElementById("profile-io");
    const newProfileBtn = document.getElementById("profile-new-btn");
    const renameProfileBtn = document.getElementById("profile-rename-btn");
    const deleteProfileBtn = document.getElementById("profile-delete-btn");
    const profileFileInput = document.getElementById("profile-file-input");

    // レイアウトUI
    const radiusSlider = document.getElementById("radius-slider");
    const radiusValue = document.getElementById("radius-value");
    const shadowSlider = document.getElementById("shadow-slider");
    const shadowValue = document.getElementById("shadow-value");

    // プロファイル選択UI
    const profileSelector = document.getElementById("profile-selector");

    // --- カラーピッカー生成 ---
    // カラーピッカーとテキスト入力を連動させるヘルパー関数
    function linkColorPickerAndTextInput(picker, textInput, updateCallback) {
        // カラーピッカーの変更をテキスト入力に反映
        picker.addEventListener('input', (e) => {
            textInput.value = e.target.value;
            updateCallback(e.target.value);
        });

        // テキスト入力の変更をカラーピッカーに反映
        textInput.addEventListener('change', (e) => {
            // #から始まる7桁の16進数カラーコードの形式か簡易チェック
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                picker.value = e.target.value;
                updateCallback(e.target.value);
            } else {
                // 不正な値の場合は、現在のピッカーの色でテキスト入力を元に戻す
                e.target.value = picker.value;
            }
        });
    }

    function createColorPickers() {
        // コンテナをクリア
        basicColorsContainer.innerHTML = '';
        segmentColorsContainer.innerHTML = '';

        // 基本色
        for (const key in settings.colors) {
            if (key !== 'segments') {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'color-item';

                // ラベルのテキストを生成 (例: hubBg -> Hub Bg)
                const labelText = key
                    .replace(/([A-Z])/g, ' $1') // 大文字の前にスペース
                    .replace(/^./, (str) => str.toUpperCase()); // 先頭を大文字に

                const label = document.createElement('label');
                label.htmlFor = `picker-${key}`;
                label.textContent = labelText;

                // 補足説明が必要なキー
                const descriptions = {
                    bg: '（プレビュー背景）',
                    wheel: '（外周）', wheelLine: '（内側ライン）', hubBg: '（ハブ本体）', hubBorder: '（ハブ外周）', axis: '（中心軸）'
                };
                if (descriptions[key]) label.textContent += ` ${descriptions[key]}`;

                const picker = document.createElement('input');
                picker.type = 'color';
                picker.id = `picker-${key}`;
                picker.value = settings.colors[key];

                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.className = 'color-text-input';
                textInput.value = settings.colors[key];

                // ピッカーとテキスト入力を連動させる
                linkColorPickerAndTextInput(picker, textInput, (newValue) => {
                    settings.colors[key] = newValue;
                    applyColors();
                });

                itemContainer.append(label, picker, textInput);
                basicColorsContainer.appendChild(itemContainer);
            }
        }

        // セグメント色
        settings.colors.segments.forEach((color, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.className = 'color-item';

            const label = document.createElement('label');
            label.htmlFor = `segment-${index}`;
            label.textContent = `Seg ${index + 1}`;
            
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = `segment-${index}`;
            picker.value = color;

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'color-text-input';
            textInput.value = color;

            // ピッカーとテキスト入力を連動させる
            linkColorPickerAndTextInput(picker, textInput, (newValue) => {
                settings.colors.segments[index] = newValue;
                applyColors();
            });

            itemContainer.append(label, picker, textInput);
            segmentColorsContainer.appendChild(itemContainer);
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
        saveCurrentProfile(); // 変更を現在のプロファイルに保存
    }

    // 半径をCSSカスタムプロパティに適用
    function applyRadius() {
        settings.segmentRadius = parseFloat(radiusSlider.value);
        radiusValue.textContent = settings.segmentRadius;
        root.style.setProperty('--segment-radius', `${settings.segmentRadius}px`);
        saveCurrentProfile(); // 変更を現在のプロファイルに保存
    }

    // 影の強さを各パーツに適用
    function applyShadows() {
        const i = settings.shadowIntensity;
        shadowValue.textContent = parseFloat(i).toFixed(2);

        // 各パーツのbox-shadowを係数 `i` を使って動的に設定
        baseEl.style.boxShadow = `0 ${10*i}px ${25*i}px rgba(0,0,0,${0.2*i}), inset 0 0 ${20*i}px rgba(0,0,0,${0.1*i})`;
        segmentsEl.style.boxShadow = `inset 0 0 ${40*i}px ${20*i}px rgba(0,0,0,${0.15*i})`;
        wheelEl.style.boxShadow = `inset 0 0 0 8px var(--wheel-line-color), inset 0 ${5*i}px ${15*i}px rgba(0,0,0,${0.1*i}), 0 ${2*i}px ${5*i}px rgba(0,0,0,${0.1*i})`;
        hubEl.style.boxShadow = `0 ${8*i}px ${15*i}px rgba(0,0,0,${0.2*i})`;
        axisEl.style.boxShadow = `inset 0 3px 8px rgba(0,0,0,0.2)`; // 影の強さスライダーの影響を受けないように固定値に変更

        saveCurrentProfile(); // 変更を現在のプロファイルに保存
    }

    function handleShadowChange() {
        settings.shadowIntensity = shadowSlider.value;
        applyShadows();
    }

    // 全ての描画を更新 (プロファイル読み込み時など)
    function updateAllVisuals() {
        createColorPickers(); // ピッカーを再生成 (セグメント数が変わる可能性があるため)
        createDividers();     // 仕切り線を再生成
        applyColors();
        applyRadius();
        applyShadows(); // 影も再適用
        
        // スライダーの値も更新
        radiusSlider.value = settings.segmentRadius;
        radiusValue.textContent = settings.segmentRadius;
        shadowSlider.value = settings.shadowIntensity;
        shadowValue.textContent = parseFloat(settings.shadowIntensity).toFixed(2);

        updateSegmentCountDisplay(); // セグメント数表示も更新
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
        
        // 以前選択していたプロファイルがあればそれを、なければ最初のプロファイルを適用
        const profileToSelect = currentProfileName && loadedProfiles[currentProfileName] ? currentProfileName : profileNames[0];
        profileSelector.value = profileToSelect;
        applyProfile(profileToSelect);
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
        currentProfileName = profileName; // 現在のプロファイル名を更新
        profileSelector.value = profileName; // ドロップダウンの選択状態を更新
        updateAllVisuals(); // 画面全体を更新
        saveProfilesToLocalStorage(); // プロファイル全体をlocalStorageに保存
    }

    // --- プロファイル管理ロジック (新規, 名前変更, 削除) ---
    function createNewProfile() {
        const newName = prompt("新しいプロファイル名を入力してください:", "新しいプロファイル");
        if (!newName) {
            return; // キャンセルされた場合
        }
        if (loadedProfiles[newName]) {
            alert("エラー: 同じ名前のプロファイルが既に存在します。");
            return;
        }
        // 現在の設定をディープコピーして新しいプロファイルを作成
        loadedProfiles[newName] = JSON.parse(JSON.stringify(settings));
        currentProfileName = newName; // 新しく作ったものを選択状態に
        updateProfileSelector();
        alert(`プロファイル「${newName}」を作成しました。`);
    }

    function renameCurrentProfile() {
        if (!currentProfileName) {
            alert("名前を変更するプロファイルが選択されていません。");
            return;
        }
        const newName = prompt("新しいプロファイル名を入力してください:", currentProfileName);
        if (!newName || newName === currentProfileName) {
            return; // キャンセルされたか、名前が変わっていない場合
        }
        if (loadedProfiles[newName]) {
            alert("エラー: 同じ名前のプロファイルが既に存在します。");
            return;
        }

        // 新しい名前で設定を保存し、古い名前のものを削除
        loadedProfiles[newName] = loadedProfiles[currentProfileName];
        delete loadedProfiles[currentProfileName];

        currentProfileName = newName; // 現在のプロファイル名を更新
        updateProfileSelector();
        alert(`プロファイル名を「${newName}」に変更しました。`);
    }

    function deleteCurrentProfile() {
        if (!currentProfileName) {
            alert("削除するプロファイルが選択されていません。");
            return;
        }
        if (Object.keys(loadedProfiles).length <= 1) {
            alert("最後のプロファイルは削除できません。");
            return;
        }
        if (confirm(`本当にプロファイル「${currentProfileName}」を削除しますか？この操作は元に戻せません。`)) {
            const deletedName = currentProfileName;
            delete loadedProfiles[currentProfileName];
            currentProfileName = null; // 選択をリセット
            updateProfileSelector(); // 残ったプロファイルの先頭が自動で選択される
            alert(`プロファイル「${deletedName}」を削除しました。`);
        }
    }

    // --- LocalStorage ロジック ---
    function saveCurrentProfile() {
        if (currentProfileName && loadedProfiles[currentProfileName]) {
            // 現在のsettingsオブジェクトを、loadedProfilesの該当プロファイルに書き戻す
            loadedProfiles[currentProfileName] = settings;
            saveProfilesToLocalStorage();
        }
    }

    function saveProfilesToLocalStorage() {
        try {
            // プロファイルリスト全体と、最後に選択していたプロファイル名を保存
            const dataToSave = {
                profiles: loadedProfiles,
                lastSelected: currentProfileName
            };
            localStorage.setItem('rouletteProfiles', JSON.stringify(dataToSave));
        } catch (e) {
            console.error("Failed to save profiles to localStorage:", e);
        }
    }

    function loadProfilesFromLocalStorage() {
        const savedData = localStorage.getItem('rouletteProfiles');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                loadedProfiles = parsedData.profiles || {};
                currentProfileName = parsedData.lastSelected || null;
                updateProfileSelector();
            } catch (e) {
                console.error("Failed to parse profiles from localStorage. Using default settings.", e);
                localStorage.removeItem('rouletteProfiles');
            }
        }
    }

    // --- セグメント数操作ロジック ---
    function updateSegmentCountDisplay() {
        const count = settings.colors.segments.length;
        segmentCountDisplay.textContent = count;
        // 最小値・最大値に達したらボタンを無効化
        removeSegmentBtn.disabled = count <= 2;
        addSegmentBtn.disabled = count >= 30;
    }

    function addSegment() {
        const segmentCount = settings.colors.segments.length;
        if (segmentCount >= 30) {
            alert("セグメントは最大30個までです。");
            return;
        }
        // 新しいセグメントの色を決定（最後の色をコピーするか、デフォルト色を追加）
        const newColor = segmentCount > 0 ? settings.colors.segments[segmentCount - 1] : '#ffffff';
        settings.colors.segments.push(newColor);
        updateAllVisuals(); // 画面を再描画
    }

    function removeSegment() {
        const segmentCount = settings.colors.segments.length;
        if (segmentCount <= 2) {
            alert("セグメントは最低2個必要です。");
            return;
        }
        settings.colors.segments.pop();
        updateAllVisuals(); // 画面を再描画
    }


    // --- イベントリスナー登録 ---
    radiusSlider.addEventListener('input', applyRadius);
    shadowSlider.addEventListener('input', handleShadowChange);
    exportBtn.addEventListener('click', exportProfile);
    importBtn.addEventListener('click', () => profileFileInput.click()); // ボタンクリックでファイル選択を開く
    profileFileInput.addEventListener('change', importProfile);
    profileSelector.addEventListener('change', (e) => applyProfile(e.target.value));
    addSegmentBtn.addEventListener('click', addSegment);
    removeSegmentBtn.addEventListener('click', removeSegment);
    newProfileBtn.addEventListener('click', createNewProfile);
    renameProfileBtn.addEventListener('click', renameCurrentProfile);
    deleteProfileBtn.addEventListener('click', deleteCurrentProfile);

    // --- 初期化処理 ---
    function init() {
        loadProfilesFromLocalStorage(); // 起動時に保存されたプロファイルリストを読み込む
        // loadProfilesFromLocalStorageがセレクタ更新と描画更新を行うため、
        // ここでのupdateAllVisuals()呼び出しは不要（重複になる）
        if (Object.keys(loadedProfiles).length === 0) {
            // localStorageに何もない初回起動時は、デフォルト設定をプロファイルとして作成
            loadedProfiles = { 'デフォルト設定': settings };
            updateProfileSelector();
        }
    }

    init(); // アプリケーション開始
});
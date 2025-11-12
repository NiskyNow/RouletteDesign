document.addEventListener("DOMContentLoaded", () => {
    
    // --- 状態管理 ---
    // アプリケーションの全ての状態をこのオブジェクトで管理する
    const AppState = {
        // 現在UIに表示されている設定（作業用のコピー）
        currentSettings: null,
        // 保存されている全てのプロファイル
        profiles: {},
        // 現在選択されているプロファイルの名前
        currentProfileName: null,
        // 未保存の変更があるかどうかのフラグ
        isDirty: false,

        // 変更があったことを記録し、UIを更新する
        setDirty(dirtyState) {
            this.isDirty = dirtyState;
            // 保存ボタンの有効/無効を切り替え
            saveProfileBtn.disabled = !dirtyState;
            // タブのタイトルで未保存の状態を示す
            updateCurrentProfileDisplay();
        }
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

    // 「設定を保存」ボタンを動的に生成してDOMに追加
    const saveProfileBtn = document.createElement('button');
    saveProfileBtn.id = 'save-profile-btn';
    saveProfileBtn.textContent = '設定を保存';
    // 削除ボタンの直後に挿入
    deleteProfileBtn.insertAdjacentElement('afterend', saveProfileBtn);

    // 現在のプロファイル名を表示する要素を動的に生成
    const currentProfileDisplay = document.createElement('p');
    currentProfileDisplay.id = 'current-profile-display';
    currentProfileDisplay.style.fontWeight = 'bold';
    currentProfileDisplay.style.marginTop = '10px';
    profileSelector.insertAdjacentElement('beforebegin', currentProfileDisplay);

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
        for (const key in AppState.currentSettings.colors) {
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
                picker.value = AppState.currentSettings.colors[key];

                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.className = 'color-text-input';
                textInput.value = AppState.currentSettings.colors[key];

                // ピッカーとテキスト入力を連動させる
                linkColorPickerAndTextInput(picker, textInput, (newValue) => {
                    AppState.currentSettings.colors[key] = newValue;
                    applyColors();
                });

                itemContainer.append(label, picker, textInput);
                basicColorsContainer.appendChild(itemContainer);
            }
        }

        // セグメント色
        AppState.currentSettings.colors.segments.forEach((color, index) => {
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
                AppState.currentSettings.colors.segments[index] = newValue;
                applyColors();
            });

            itemContainer.append(label, picker, textInput);
            segmentColorsContainer.appendChild(itemContainer);
        });
    }

    // --- 仕切り線生成 ---
    function createDividers() {
        dividersContainer.innerHTML = ''; // クリア
        const segmentCount = AppState.currentSettings.colors.segments.length;
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
        for (const key in AppState.currentSettings.colors) {
            if (key !== 'segments') {
                // CSS変数キーを生成 (例: hubBg -> --hub-bg-color)
                const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                const cssVar = `--${cssVarName}-color`;
                root.style.setProperty(cssVar, AppState.currentSettings.colors[key]);
            }
        }

        // セグメント (conic-gradientを生成)
        const segmentCount = AppState.currentSettings.colors.segments.length;
        if (segmentCount === 0) {
            root.style.setProperty('--segments-gradient', 'conic-gradient(#fff 0% 100%)');
            return;
        }
        
        const step = 100 / segmentCount;
        let gradientStops = [];
        let currentPos = 0;

        AppState.currentSettings.colors.segments.forEach((color, index) => {
            const start = currentPos;
            const end = (index === segmentCount - 1) ? 100 : (currentPos + step);
            gradientStops.push(`${color} ${start}% ${end}%`);
            currentPos = end;
        });

        root.style.setProperty('--segments-gradient', `conic-gradient(${gradientStops.join(', ')})`);
        AppState.setDirty(true);
    }

    // 半径をCSSカスタムプロパティに適用
    function applyRadius() {
        AppState.currentSettings.segmentRadius = parseFloat(radiusSlider.value);
        radiusValue.textContent = AppState.currentSettings.segmentRadius;
        root.style.setProperty('--segment-radius', `${AppState.currentSettings.segmentRadius}px`);
        AppState.setDirty(true);
    }

    // 影の強さを各パーツに適用
    function applyShadows() {
        const i = AppState.currentSettings.shadowIntensity;
        shadowValue.textContent = parseFloat(i).toFixed(2);

        // 各パーツのbox-shadowを係数 `i` を使って動的に設定
        baseEl.style.boxShadow = `0 ${10*i}px ${25*i}px rgba(0,0,0,${0.2*i}), inset 0 0 ${20*i}px rgba(0,0,0,${0.1*i})`;
        segmentsEl.style.boxShadow = `inset 0 0 ${40*i}px ${20*i}px rgba(0,0,0,${0.15*i})`;
        wheelEl.style.boxShadow = `inset 0 0 0 8px var(--wheel-line-color), inset 0 ${5*i}px ${15*i}px rgba(0,0,0,${0.1*i}), 0 ${2*i}px ${5*i}px rgba(0,0,0,${0.1*i})`;
        hubEl.style.boxShadow = `0 ${8*i}px ${15*i}px rgba(0,0,0,${0.2*i})`;
        axisEl.style.boxShadow = 'none';

        AppState.setDirty(true);
    }

    function handleShadowChange() {
        AppState.currentSettings.shadowIntensity = shadowSlider.value;
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
        radiusSlider.value = AppState.currentSettings.segmentRadius;
        radiusValue.textContent = AppState.currentSettings.segmentRadius;
        shadowSlider.value = AppState.currentSettings.shadowIntensity;
        shadowValue.textContent = parseFloat(AppState.currentSettings.shadowIntensity).toFixed(2);

        updateSegmentCountDisplay(); // セグメント数表示も更新
    }

    // --- プロファイル選択ロジック ---
    function updateProfileSelector() {
        profileSelector.innerHTML = ''; // 既存の選択肢をクリア

        const profileNames = Object.keys(AppState.profiles);

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
        const profileToSelect = AppState.currentProfileName && AppState.profiles[AppState.currentProfileName] ? AppState.currentProfileName : profileNames[0];
        profileSelector.value = profileToSelect;
        applyProfile(profileToSelect);
    }

    // --- ファイルI/O ロジック ---
    function exportProfile() {
        if (!AppState.currentProfileName) return;
        const name = AppState.currentProfileName;
        const dataStr = JSON.stringify(AppState.currentSettings, null, 2); // 整形したJSON
        
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
                if (importedSettings.profiles && importedSettings.lastSelected) {
                    // 複数プロファイルの場合
                    Object.assign(AppState.profiles, importedSettings.profiles);
                    alert(`${Object.keys(importedSettings.profiles).length}件のプロファイルをインポート（マージ）しました。`);

                } else if (importedSettings.colors && importedSettings.segmentRadius !== undefined) {
                    // 単一プロファイルの場合、既存のプロファイルを全てクリアし、これだけを読み込む
                    const filename = file.name;
                    const profileName = filename.replace(/\.(json|txt)$/i, ''); // 拡張子を削除

                    AppState.profiles = {}; // 既存のプロファイルを全て削除
                    AppState.profiles[profileName] = importedSettings;
                    AppState.currentProfileName = profileName; // インポートしたものを選択状態に
                    alert(`プロファイル「${profileName}」をインポートし、既存のプロファイルを置き換えました。`);
                } else {
                    throw new Error("不明なファイル形式です。");
                }
                
                // 読み込んだ内容をテキストエリアに表示
                profileIO.value = JSON.stringify(AppState.profiles, null, 2);

                // プロファイルセレクターを更新
                updateProfileSelector();
                
                // インポートした内容をlocalStorageに即時保存
                saveProfilesToLocalStorage();

            } catch (e) {
                alert("ファイルの読み込みに失敗しました。JSON形式が正しくないか、対応していないファイル形式です。");
                console.error("Import Error:", e);
            }
        };
        reader.onerror = () => {
            alert("ファイルの読み込みに失敗しました。");
        };
        reader.readAsText(file);
    }

    function applyProfile(profileName) {
        // 未保存の変更がある場合は確認
        if (AppState.isDirty) {
            if (!confirm("未保存の変更があります。変更を破棄してプロファイルを切り替えますか？")) {
                profileSelector.value = AppState.currentProfileName; // ドロップダウンを元に戻す
                return;
            }
        }

        if (!AppState.profiles[profileName]) {
            console.error(`Profile "${profileName}" not found.`);
            return;
        }

        // 選択されたプロファイルの設定を「現在の設定」としてディープコピー
        AppState.currentSettings = JSON.parse(JSON.stringify(AppState.profiles[profileName]));
        AppState.currentProfileName = profileName;

        profileSelector.value = profileName; // ドロップダウンの選択状態を更新
        updateAllVisuals(); // 画面全体を更新
        AppState.setDirty(false); // 保存済みの状態なのでDirtyフラグをリセット
    }

    // 現在のプロファイル名を表示に反映させる関数
    function updateCurrentProfileDisplay() {
        if (AppState.currentProfileName) {
            const dirtyIndicator = AppState.isDirty ? " *" : "";
            const displayText = `現在のプロファイル: ${AppState.currentProfileName}${dirtyIndicator}`;
            currentProfileDisplay.textContent = displayText;
            document.title = `ルーレット設定 - ${AppState.currentProfileName}${dirtyIndicator}`;
        } else {
            currentProfileDisplay.textContent = 'プロファイルが選択されていません';
            document.title = 'ルーレット設定';
        }
    }


    // --- プロファイル管理ロジック (新規, 名前変更, 削除) ---
    function createNewProfile() {
        const newName = prompt("新しいプロファイル名を入力してください:", "新しいプロファイル");
        if (!newName) {
            return; // キャンセルされた場合
        }
        if (AppState.profiles[newName]) {
            alert("エラー: 同じ名前のプロファイルが既に存在します。");
            return;
        }
        // 現在の設定をディープコピーして新しいプロファイルを作成
        AppState.profiles[newName] = JSON.parse(JSON.stringify(AppState.currentSettings));
        AppState.currentProfileName = newName; // 新しく作ったものを選択状態に
        updateProfileSelector();
        AppState.setDirty(false); // 新規作成時は保存済みとみなす
        alert(`プロファイル「${newName}」を作成しました。`);
    }

    function renameCurrentProfile() {
        if (!AppState.currentProfileName) {
            alert("名前を変更するプロファイルが選択されていません。");
            return;
        }
        const newName = prompt("新しいプロファイル名を入力してください:", AppState.currentProfileName);
        if (!newName || newName === AppState.currentProfileName) {
            return; // キャンセルされたか、名前が変わっていない場合
        }
        if (AppState.profiles[newName]) {
            alert("エラー: 同じ名前のプロファイルが既に存在します。");
            return;
        }

        // 新しい名前で設定を保存し、古い名前のものを削除
        AppState.profiles[newName] = AppState.profiles[AppState.currentProfileName];
        delete AppState.profiles[AppState.currentProfileName];

        AppState.currentProfileName = newName; // 現在のプロファイル名を更新
        updateProfileSelector();
        saveProfilesToLocalStorage(); // 名前の変更を即時保存
        alert(`プロファイル名を「${newName}」に変更しました。`);
    }

    function deleteCurrentProfile() {
        if (!AppState.currentProfileName) {
            alert("削除するプロファイルが選択されていません。");
            return;
        }
        if (Object.keys(AppState.profiles).length <= 1) {
            alert("最後のプロファイルは削除できません。");
            return;
        }
        if (confirm(`本当にプロファイル「${AppState.currentProfileName}」を削除しますか？この操作は元に戻せません。`)) {
            const deletedName = AppState.currentProfileName;
            delete AppState.profiles[AppState.currentProfileName];
            AppState.currentProfileName = null; // 選択をリセット
            updateProfileSelector(); // 残ったプロファイルの先頭が自動で選択される
            alert(`プロファイル「${deletedName}」を削除しました。`);
        }
    }

    // --- LocalStorage ロジック ---
    function saveCurrentProfile() {
        if (!AppState.currentProfileName) return;

        // 現在の作業用設定を、保存用プロファイルにディープコピーして上書き
        AppState.profiles[AppState.currentProfileName] = JSON.parse(JSON.stringify(AppState.currentSettings));
        saveProfilesToLocalStorage();
        AppState.setDirty(false); // 保存したのでDirtyフラグをリセット
        alert(`プロファイル「${AppState.currentProfileName}」を保存しました。`);
    }

    function saveProfilesToLocalStorage() {
        try {
            // プロファイルリスト全体と、最後に選択していたプロファイル名を保存
            const dataToSave = {
                profiles: AppState.profiles,
                lastSelected: AppState.currentProfileName
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
                AppState.profiles = parsedData.profiles || {};
                AppState.currentProfileName = parsedData.lastSelected || null;
                // updateProfileSelector(); // init()の最後で呼ばれるので不要
            } catch (e) {
                console.error("Failed to parse profiles from localStorage. Using default settings.", e);
                localStorage.removeItem('rouletteProfiles');
            }
        }
    }

    // --- セグメント数操作ロジック ---
    function updateSegmentCountDisplay() {
        const count = AppState.currentSettings.colors.segments.length;
        segmentCountDisplay.textContent = count;
        // 最小値・最大値に達したらボタンを無効化
        removeSegmentBtn.disabled = count <= 2;
        addSegmentBtn.disabled = count >= 30;
    }

    function addSegment() {
        const segmentCount = AppState.currentSettings.colors.segments.length;
        if (segmentCount >= 30) {
            alert("セグメントは最大30個までです。");
            return;
        }

        let newColor;
        // 保存されている（変更が適用される前）のプロファイル情報を取得
        const originalProfile = AppState.profiles[AppState.currentProfileName];

        // もし元のプロファイルに、次に追加するセグメントの色情報が存在すれば、それを採用する
        if (originalProfile && originalProfile.colors.segments[segmentCount]) {
            newColor = originalProfile.colors.segments[segmentCount];
        } else {
            // 存在しない場合は、デフォルトのカラーパレットから新しい色を割り当てる
            const defaultSegmentColors = ["#ff8c00", "#ffd700", "#32cd32", "#4682b4", "#9370db", "#ff69b4", "#dc143c", "#00ced1", "#ff4500", "#8a2be2"];
            newColor = defaultSegmentColors[segmentCount % defaultSegmentColors.length];
        }

        AppState.currentSettings.colors.segments.push(newColor);
        AppState.setDirty(true);
        updateAllVisuals(); // 画面を再描画
    }

    function removeSegment() {
        const segmentCount = AppState.currentSettings.colors.segments.length;
        if (segmentCount <= 2) {
            alert("セグメントは最低2個必要です。");
            return;
        }
        AppState.currentSettings.colors.segments.pop();
        AppState.setDirty(true);
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

    saveProfileBtn.addEventListener('click', saveCurrentProfile); // 保存ボタンのイベントリスナー
    // --- 初期化処理 ---
    function init() {
        loadProfilesFromLocalStorage(); // 起動時に保存されたプロファイルリストを読み込む
        
        if (Object.keys(AppState.profiles).length === 0) {
            // localStorageに何もない初回起動時は、デフォルト設定をプロファイルとして作成
            const defaultSettings = {
                colors: {
                    bg: "#f0f0f0", base: "#d9d9d9", divider: "#333333", wheel: "#fffacd",
                    wheelLine: "#f0e68c", hubBg: "#d3d3d3", hubBorder: "#a9a9a9", axis: "#5a5a5a",
                    segments: ["#ff8c00", "#ffd700", "#32cd32", "#4682b4", "#9370db", "#ff69b4", "#dc143c", "#00ced1", "#ff4500", "#8a2be2"]
                },
                segmentRadius: 372.5,
                shadowIntensity: 1.0
            };
            AppState.profiles = { 'デフォルト設定': defaultSettings };
            AppState.currentProfileName = 'デフォルト設定';
            saveProfilesToLocalStorage(); // 初回設定を保存
        }

        // アプリケーションの起動
        updateProfileSelector(); // プロファイル一覧を更新し、最初のプロファイルを適用・描画する
        AppState.setDirty(false); // 起動時は常に保存済み状態
    }

    init(); // アプリケーション開始
});
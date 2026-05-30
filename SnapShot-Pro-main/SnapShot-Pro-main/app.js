        const history = {
            past: [],
            future: [],
            maxSize: 50
        };

        // Application State
        const state = {
            image: null,
            svgCode: null,
            imageTransform: {
                rotation: 0, // 0, 90, 180, 270
                flipH: false,
                flipV: false
            },
            imageFilters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                blur: 0,
                grayscale: 0,
                sepia: 0
            },
            textOverlay: {
                enabled: false,
                content: '',
                size: 48,
                font: 'Arial',
                color: '#ffffff',
                bold: false,
                italic: false,
                x: 0.5,
                y: 0.5
            },
            windowOverlay: {
                enabled: false,
                style: 'macos',
                title: 'Screenshot',
                height: 40,
                showControls: true
            },
            watermark: {
                enabled: false,
                text: '',
                position: 'bottom-right',
                size: 16,
                opacity: 50,
                color: '#ffffff'
            },
            exportSettings: {
                format: 'png',
                quality: 92
            },
            gradient: {
                type: 'linear',
                angle: 135,
                colors: ['#667eea', '#764ba2'],
                positions: [0, 100]
            },
            padding: 60,
            scale: 100,
            borderRadius: 12,
            showBorder: false,
            borderWidth: 2,
            borderColor: '#ffffff',
            shadow: {
                blur: 40,
                spread: 10,
                opacity: 30,
                x: 0,
                y: 10,
                color: '#000000'
            },
            canvas: {
                width: 1200,
                height: 675
            }
        };

        // Save state to history
        function saveStateToHistory() {
            const stateCopy = JSON.parse(JSON.stringify({
                imageTransform: state.imageTransform,
                imageFilters: state.imageFilters,
                textOverlay: state.textOverlay,
                windowOverlay: state.windowOverlay,
                watermark: state.watermark,
                gradient: state.gradient,
                padding: state.padding,
                scale: state.scale,
                borderRadius: state.borderRadius,
                showBorder: state.showBorder,
                borderWidth: state.borderWidth,
                borderColor: state.borderColor,
                shadow: state.shadow,
                canvas: state.canvas
            }));

            history.past.push(stateCopy);
            if (history.past.length > history.maxSize) {
                history.past.shift();
            }
            history.future = [];
            updateHistoryButtons();
        }

        // Undo action
        function undo() {
            if (history.past.length === 0) return;

            const currentState = JSON.parse(JSON.stringify({
                imageTransform: state.imageTransform,
                imageFilters: state.imageFilters,
                textOverlay: state.textOverlay,
                windowOverlay: state.windowOverlay,
                watermark: state.watermark,
                gradient: state.gradient,
                padding: state.padding,
                scale: state.scale,
                borderRadius: state.borderRadius,
                showBorder: state.showBorder,
                borderWidth: state.borderWidth,
                borderColor: state.borderColor,
                shadow: state.shadow,
                canvas: state.canvas
            }));

            history.future.push(currentState);
            const previousState = history.past.pop();

            Object.assign(state, previousState);
            updateUIFromState();
            render();
            updateHistoryButtons();
        }

        // Redo action
        function redo() {
            if (history.future.length === 0) return;

            const currentState = JSON.parse(JSON.stringify({
                imageTransform: state.imageTransform,
                imageFilters: state.imageFilters,
                textOverlay: state.textOverlay,
                windowOverlay: state.windowOverlay,
                watermark: state.watermark,
                gradient: state.gradient,
                padding: state.padding,
                scale: state.scale,
                borderRadius: state.borderRadius,
                showBorder: state.showBorder,
                borderWidth: state.borderWidth,
                borderColor: state.borderColor,
                shadow: state.shadow,
                canvas: state.canvas
            }));

            history.past.push(currentState);
            const nextState = history.future.pop();

            Object.assign(state, nextState);
            updateUIFromState();
            render();
            updateHistoryButtons();
        }

        // Update history buttons state
        function updateHistoryButtons() {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            undoBtn.disabled = history.past.length === 0;
            redoBtn.disabled = history.future.length === 0;
        }

        // Update UI from state
        function updateUIFromState() {
            // Image filters
            elements.brightness.value = state.imageFilters.brightness;
            elements.brightnessValue.textContent = `${state.imageFilters.brightness}%`;
            elements.contrast.value = state.imageFilters.contrast;
            elements.contrastValue.textContent = `${state.imageFilters.contrast}%`;
            elements.saturation.value = state.imageFilters.saturation;
            elements.saturationValue.textContent = `${state.imageFilters.saturation}%`;
            elements.blur.value = state.imageFilters.blur;
            elements.blurValue.textContent = `${state.imageFilters.blur}px`;
            elements.grayscale.value = state.imageFilters.grayscale;
            elements.grayscaleValue.textContent = `${state.imageFilters.grayscale}%`;
            elements.sepia.value = state.imageFilters.sepia;
            elements.sepiaValue.textContent = `${state.imageFilters.sepia}%`;

            elements.gradientType.value = state.gradient.type;
            elements.gradientAngle.value = state.gradient.angle;
            elements.gradientAngleValue.textContent = `${state.gradient.angle}°`;
            elements.gradientColor1.value = state.gradient.colors[0];
            elements.gradientColor2.value = state.gradient.colors[1];
            elements.gradientPos1.value = state.gradient.positions[0];
            elements.gradientPos2.value = state.gradient.positions[1];
            elements.gradientPos1Value.textContent = `${state.gradient.positions[0]}%`;
            elements.gradientPos2Value.textContent = `${state.gradient.positions[1]}%`;

            elements.padding.value = state.padding;
            elements.paddingValue.textContent = `${state.padding}px`;
            elements.scale.value = state.scale;
            elements.scaleValue.textContent = `${state.scale}%`;
            elements.borderRadius.value = state.borderRadius;
            elements.borderRadiusValue.textContent = `${state.borderRadius}px`;
            elements.showBorder.checked = state.showBorder;
            elements.borderControls.style.display = state.showBorder ? 'block' : 'none';
            elements.borderWidth.value = state.borderWidth;
            elements.borderWidthValue.textContent = `${state.borderWidth}px`;
            elements.borderColor.value = state.borderColor;
            elements.borderColorText.value = state.borderColor;

            elements.shadowBlur.value = state.shadow.blur;
            elements.shadowBlurValue.textContent = `${state.shadow.blur}px`;
            elements.shadowSpread.value = state.shadow.spread;
            elements.shadowSpreadValue.textContent = `${state.shadow.spread}px`;
            elements.shadowOpacity.value = state.shadow.opacity;
            elements.shadowOpacityValue.textContent = `${state.shadow.opacity}%`;
            elements.shadowX.value = state.shadow.x;
            elements.shadowXValue.textContent = `${state.shadow.x}px`;
            elements.shadowY.value = state.shadow.y;
            elements.shadowYValue.textContent = `${state.shadow.y}px`;
            elements.shadowColor.value = state.shadow.color;
            elements.shadowColorText.value = state.shadow.color;

            elements.canvasWidth.value = state.canvas.width;
            elements.canvasHeight.value = state.canvas.height;

            // Text overlay
            elements.textControls.style.display = state.textOverlay.enabled ? 'block' : 'none';
            elements.textContent.value = state.textOverlay.content;
            elements.textSize.value = state.textOverlay.size;
            elements.textSizeValue.textContent = state.textOverlay.size;
            elements.textFont.value = state.textOverlay.font;
            elements.textColor.value = state.textOverlay.color;
            elements.textColorText.value = state.textOverlay.color;
            elements.textBold.checked = state.textOverlay.bold;
            elements.textItalic.checked = state.textOverlay.italic;

            // Window overlay
            elements.windowOverlayEnabled.checked = state.windowOverlay.enabled;
            elements.windowOverlayControls.style.display = state.windowOverlay.enabled ? 'block' : 'none';
            elements.windowOverlayStyle.value = state.windowOverlay.style;
            elements.windowOverlayTitle.value = state.windowOverlay.title;
            elements.windowOverlayHeight.value = state.windowOverlay.height;
            elements.windowOverlayHeightValue.textContent = state.windowOverlay.height + 'px';
            elements.windowShowControls.checked = state.windowOverlay.showControls;

            // Watermark
            elements.watermarkEnabled.checked = state.watermark.enabled;
            elements.watermarkControls.style.display = state.watermark.enabled ? 'block' : 'none';
            elements.watermarkText.value = state.watermark.text;
            elements.watermarkPosition.value = state.watermark.position;
            elements.watermarkSize.value = state.watermark.size;
            elements.watermarkSizeValue.textContent = state.watermark.size + 'px';
            elements.watermarkOpacity.value = state.watermark.opacity;
            elements.watermarkOpacityValue.textContent = state.watermark.opacity + '%';
            elements.watermarkColor.value = state.watermark.color;
            elements.watermarkColorText.value = state.watermark.color;

            // Export settings
            elements.exportFormat.value = state.exportSettings.format;
            elements.qualityControls.style.display = (state.exportSettings.format === 'jpeg' || state.exportSettings.format === 'webp') ? 'block' : 'none';
            elements.exportQuality.value = state.exportSettings.quality;
            elements.exportQualityValue.textContent = state.exportSettings.quality + '%';

            updateAngleIndicator();
            updateGradientPreview();
        }

        // Gradient Presets
        const gradientPresets = {
            sunset: {
                colors: ['#667eea', '#764ba2'],
                positions: [0, 100],
                angle: 135
            },
            ocean: {
                colors: ['#2E3192', '#1BFFFF'],
                positions: [0, 100],
                angle: 135
            },
            forest: {
                colors: ['#134E5E', '#71B280'],
                positions: [0, 100],
                angle: 135
            },
            fire: {
                colors: ['#F2994A', '#F2C94C'],
                positions: [0, 100],
                angle: 135
            },
            midnight: {
                colors: ['#0F2027', '#2C5364'],
                positions: [0, 100],
                angle: 135
            },
            rose: {
                colors: ['#ED4264', '#FFEDBC'],
                positions: [0, 100],
                angle: 135
            },
            purple: {
                colors: ['#A8EDEA', '#FED6E3'],
                positions: [0, 100],
                angle: 135
            },
            mint: {
                colors: ['#84fab0', '#8fd3f4'],
                positions: [0, 100],
                angle: 135
            }
        };

        // Shadow Presets
        const shadowPresets = {
            soft: { blur: 40, spread: 10, opacity: 30, x: 0, y: 10 },
            medium: { blur: 60, spread: 20, opacity: 40, x: 0, y: 20 },
            hard: { blur: 80, spread: 30, opacity: 50, x: 0, y: 30 },
            none: { blur: 0, spread: 0, opacity: 0, x: 0, y: 0 }
        };

        // Canvas Size Presets
        const sizePresets = {
            twitter: { width: 1200, height: 675 },
            instagram: { width: 1080, height: 1080 },
            facebook: { width: 1200, height: 630 },
            linkedin: { width: 1200, height: 627 }
        };

        // DOM Elements
        const elements = {
            uploadZone: document.getElementById('upload-zone'),
            canvasWrapper: document.getElementById('canvas-wrapper'),
            canvas: document.getElementById('preview-canvas'),
            fileInput: document.getElementById('file-input'),
            uploadBtn: document.getElementById('upload-btn'),
            svgBtn: document.getElementById('svg-btn'),
            renderSvgBtn: document.getElementById('render-svg-btn'),
            svgInputContainer: document.getElementById('svg-input-container'),
            svgCodeInput: document.getElementById('svg-code-input'),
            exportBtn: document.getElementById('export-btn'),
            resetBtn: document.getElementById('reset-btn'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            dropZone: document.getElementById('drop-zone'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),

            // Image editing controls
            rotateLeftBtn: document.getElementById('rotate-left-btn'),
            rotateRightBtn: document.getElementById('rotate-right-btn'),
            flipHBtn: document.getElementById('flip-h-btn'),
            flipVBtn: document.getElementById('flip-v-btn'),
            brightness: document.getElementById('brightness'),
            brightnessValue: document.getElementById('brightness-value'),
            contrast: document.getElementById('contrast'),
            contrastValue: document.getElementById('contrast-value'),
            saturation: document.getElementById('saturation'),
            saturationValue: document.getElementById('saturation-value'),
            blur: document.getElementById('blur'),
            blurValue: document.getElementById('blur-value'),
            grayscale: document.getElementById('grayscale'),
            grayscaleValue: document.getElementById('grayscale-value'),
            sepia: document.getElementById('sepia'),
            sepiaValue: document.getElementById('sepia-value'),

            // Gradient controls
            gradientType: document.getElementById('gradient-type'),
            gradientAngle: document.getElementById('gradient-angle'),
            gradientAngleValue: document.getElementById('gradient-angle-value'),
            gradientAngleGroup: document.getElementById('gradient-angle-group'),
            angleIndicator: document.getElementById('angle-indicator'),
            gradientColor1: document.getElementById('gradient-color-1'),
            gradientColor2: document.getElementById('gradient-color-2'),
            gradientPos1: document.getElementById('gradient-pos-1'),
            gradientPos2: document.getElementById('gradient-pos-2'),
            gradientPos1Value: document.getElementById('gradient-pos-1-value'),
            gradientPos2Value: document.getElementById('gradient-pos-2-value'),
            gradientPreview: document.getElementById('gradient-preview'),

            // Image settings
            padding: document.getElementById('padding'),
            paddingValue: document.getElementById('padding-value'),
            scale: document.getElementById('scale'),
            scaleValue: document.getElementById('scale-value'),
            borderRadius: document.getElementById('border-radius'),
            borderRadiusValue: document.getElementById('border-radius-value'),
            showBorder: document.getElementById('show-border'),
            borderControls: document.getElementById('border-controls'),
            borderWidth: document.getElementById('border-width'),
            borderWidthValue: document.getElementById('border-width-value'),
            borderColor: document.getElementById('border-color'),
            borderColorText: document.getElementById('border-color-text'),

            // Shadow settings
            shadowBlur: document.getElementById('shadow-blur'),
            shadowBlurValue: document.getElementById('shadow-blur-value'),
            shadowSpread: document.getElementById('shadow-spread'),
            shadowSpreadValue: document.getElementById('shadow-spread-value'),
            shadowOpacity: document.getElementById('shadow-opacity'),
            shadowOpacityValue: document.getElementById('shadow-opacity-value'),
            shadowX: document.getElementById('shadow-x'),
            shadowXValue: document.getElementById('shadow-x-value'),
            shadowY: document.getElementById('shadow-y'),
            shadowYValue: document.getElementById('shadow-y-value'),
            shadowColor: document.getElementById('shadow-color'),
            shadowColorText: document.getElementById('shadow-color-text'),

            // Canvas settings
            canvasWidth: document.getElementById('canvas-width'),
            canvasHeight: document.getElementById('canvas-height'),

            // Text overlay controls
            addTextBtn: document.getElementById('add-text-btn'),
            textControls: document.getElementById('text-controls'),
            textContent: document.getElementById('text-content'),
            textSize: document.getElementById('text-size'),
            textSizeValue: document.getElementById('text-size-value'),
            textFont: document.getElementById('text-font'),
            textColor: document.getElementById('text-color'),
            textColorText: document.getElementById('text-color-text'),
            textBold: document.getElementById('text-bold'),
            textItalic: document.getElementById('text-italic'),
            removeTextBtn: document.getElementById('remove-text-btn'),

            // Window overlay controls
            windowOverlayEnabled: document.getElementById('window-overlay-enabled'),
            windowOverlayControls: document.getElementById('window-overlay-controls'),
            windowOverlayStyle: document.getElementById('window-overlay-style'),
            windowOverlayTitle: document.getElementById('window-overlay-title'),
            windowOverlayHeight: document.getElementById('window-overlay-height'),
            windowOverlayHeightValue: document.getElementById('window-overlay-height-value'),
            windowShowControls: document.getElementById('window-show-controls'),

            // Watermark controls
            watermarkEnabled: document.getElementById('watermark-enabled'),
            watermarkControls: document.getElementById('watermark-controls'),
            watermarkText: document.getElementById('watermark-text'),
            watermarkPosition: document.getElementById('watermark-position'),
            watermarkSize: document.getElementById('watermark-size'),
            watermarkSizeValue: document.getElementById('watermark-size-value'),
            watermarkOpacity: document.getElementById('watermark-opacity'),
            watermarkOpacityValue: document.getElementById('watermark-opacity-value'),
            watermarkColor: document.getElementById('watermark-color'),
            watermarkColorText: document.getElementById('watermark-color-text'),

            // Export controls
            exportFormat: document.getElementById('export-format'),
            qualityControls: document.getElementById('quality-controls'),
            exportQuality: document.getElementById('export-quality'),
            exportQualityValue: document.getElementById('export-quality-value'),
            copyClipboardBtn: document.getElementById('copy-clipboard-btn'),

            // Template controls
            templateName: document.getElementById('template-name'),
            saveTemplateBtn: document.getElementById('save-template-btn'),
            clearTemplatesBtn: document.getElementById('clear-templates-btn'),
            templateList: document.getElementById('template-list'),
            loadTemplateBtn: document.getElementById('load-template-btn'),
            templateInfo: document.getElementById('template-info')
        };

        // Initialize Canvas Context
        const ctx = elements.canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get 2D canvas context');
            showNotification('Canvas not supported in this browser!', 'error');
        }

        // Event Listeners Setup
        function setupEventListeners() {
            // Upload button
            elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
            elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
            elements.fileInput.addEventListener('change', handleFileSelect);

            // SVG button
            elements.svgBtn.addEventListener('click', toggleSvgInput);
            elements.renderSvgBtn.addEventListener('click', renderSvgCode);

            // Export and Reset
            elements.exportBtn.addEventListener('click', exportImage);
            elements.resetBtn.addEventListener('click', resetToDefaults);

            // Undo/Redo
            elements.undoBtn.addEventListener('click', undo);
            elements.redoBtn.addEventListener('click', redo);

            // Image editing - Transform
            elements.rotateLeftBtn.addEventListener('click', () => {
                saveStateToHistory();
                state.imageTransform.rotation = (state.imageTransform.rotation - 90 + 360) % 360;
                render();
            });

            elements.rotateRightBtn.addEventListener('click', () => {
                saveStateToHistory();
                state.imageTransform.rotation = (state.imageTransform.rotation + 90) % 360;
                render();
            });

            elements.flipHBtn.addEventListener('click', () => {
                saveStateToHistory();
                state.imageTransform.flipH = !state.imageTransform.flipH;
                render();
            });

            elements.flipVBtn.addEventListener('click', () => {
                saveStateToHistory();
                state.imageTransform.flipV = !state.imageTransform.flipV;
                render();
            });

            // Image editing - Filters
            elements.brightness.addEventListener('input', (e) => {
                state.imageFilters.brightness = parseInt(e.target.value);
                elements.brightnessValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.brightness.addEventListener('change', () => saveStateToHistory());

            elements.contrast.addEventListener('input', (e) => {
                state.imageFilters.contrast = parseInt(e.target.value);
                elements.contrastValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.contrast.addEventListener('change', () => saveStateToHistory());

            elements.saturation.addEventListener('input', (e) => {
                state.imageFilters.saturation = parseInt(e.target.value);
                elements.saturationValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.saturation.addEventListener('change', () => saveStateToHistory());

            elements.blur.addEventListener('input', (e) => {
                state.imageFilters.blur = parseInt(e.target.value);
                elements.blurValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.blur.addEventListener('change', () => saveStateToHistory());

            elements.grayscale.addEventListener('input', (e) => {
                state.imageFilters.grayscale = parseInt(e.target.value);
                elements.grayscaleValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.grayscale.addEventListener('change', () => saveStateToHistory());

            elements.sepia.addEventListener('input', (e) => {
                state.imageFilters.sepia = parseInt(e.target.value);
                elements.sepiaValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.sepia.addEventListener('change', () => saveStateToHistory());

            // Drag and Drop
            elements.dropZone.addEventListener('dragover', handleDragOver);
            elements.dropZone.addEventListener('dragleave', handleDragLeave);
            elements.dropZone.addEventListener('drop', handleDrop);

            // Paste
            document.addEventListener('paste', handlePaste);

            // Gradient controls
            elements.gradientType.addEventListener('change', (e) => {
                state.gradient.type = e.target.value;
                elements.gradientAngleGroup.style.display =
                    e.target.value === 'linear' ? 'block' : 'none';
                updateGradientPreview();
                render();
            });

            elements.gradientAngle.addEventListener('input', (e) => {
                state.gradient.angle = parseInt(e.target.value);
                elements.gradientAngleValue.textContent = `${e.target.value}°`;
                updateAngleIndicator();
                updateGradientPreview();
                render();
            });

            elements.gradientColor1.addEventListener('input', (e) => {
                state.gradient.colors[0] = e.target.value;
                updateGradientPreview();
                render();
            });

            elements.gradientColor2.addEventListener('input', (e) => {
                state.gradient.colors[1] = e.target.value;
                updateGradientPreview();
                render();
            });

            elements.gradientPos1.addEventListener('input', (e) => {
                state.gradient.positions[0] = parseInt(e.target.value);
                elements.gradientPos1Value.textContent = `${e.target.value}%`;
                updateGradientPreview();
                render();
            });

            elements.gradientPos2.addEventListener('input', (e) => {
                state.gradient.positions[1] = parseInt(e.target.value);
                elements.gradientPos2Value.textContent = `${e.target.value}%`;
                updateGradientPreview();
                render();
            });

            // Image settings
            elements.padding.addEventListener('input', (e) => {
                state.padding = parseInt(e.target.value);
                elements.paddingValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.padding.addEventListener('change', () => saveStateToHistory());

            elements.scale.addEventListener('input', (e) => {
                state.scale = parseInt(e.target.value);
                elements.scaleValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.scale.addEventListener('change', () => saveStateToHistory());

            elements.borderRadius.addEventListener('input', (e) => {
                state.borderRadius = parseInt(e.target.value);
                elements.borderRadiusValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.borderRadius.addEventListener('change', () => saveStateToHistory());

            elements.showBorder.addEventListener('change', (e) => {
                state.showBorder = e.target.checked;
                elements.borderControls.style.display = e.target.checked ? 'block' : 'none';
                render();
            });

            elements.borderWidth.addEventListener('input', (e) => {
                state.borderWidth = parseInt(e.target.value);
                elements.borderWidthValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.borderWidth.addEventListener('change', () => saveStateToHistory());

            elements.borderColor.addEventListener('input', (e) => {
                state.borderColor = e.target.value;
                elements.borderColorText.value = e.target.value;
                render();
            });

            elements.borderColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    state.borderColor = e.target.value;
                    elements.borderColor.value = e.target.value;
                    render();
                }
            });

            // Shadow settings
            elements.shadowBlur.addEventListener('input', (e) => {
                state.shadow.blur = parseInt(e.target.value);
                elements.shadowBlurValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.shadowBlur.addEventListener('change', () => saveStateToHistory());

            elements.shadowSpread.addEventListener('input', (e) => {
                state.shadow.spread = parseInt(e.target.value);
                elements.shadowSpreadValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.shadowSpread.addEventListener('change', () => saveStateToHistory());

            elements.shadowOpacity.addEventListener('input', (e) => {
                state.shadow.opacity = parseInt(e.target.value);
                elements.shadowOpacityValue.textContent = `${e.target.value}%`;
                render();
            });
            elements.shadowOpacity.addEventListener('change', () => saveStateToHistory());

            elements.shadowX.addEventListener('input', (e) => {
                state.shadow.x = parseInt(e.target.value);
                elements.shadowXValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.shadowX.addEventListener('change', () => saveStateToHistory());

            elements.shadowY.addEventListener('input', (e) => {
                state.shadow.y = parseInt(e.target.value);
                elements.shadowYValue.textContent = `${e.target.value}px`;
                render();
            });
            elements.shadowY.addEventListener('change', () => saveStateToHistory());

            elements.shadowColor.addEventListener('input', (e) => {
                state.shadow.color = e.target.value;
                elements.shadowColorText.value = e.target.value;
                render();
            });

            elements.shadowColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    state.shadow.color = e.target.value;
                    elements.shadowColor.value = e.target.value;
                    render();
                }
            });

            // Canvas settings
            elements.canvasWidth.addEventListener('input', (e) => {
                state.canvas.width = parseInt(e.target.value);
                render();
            });

            elements.canvasHeight.addEventListener('input', (e) => {
                state.canvas.height = parseInt(e.target.value);
                render();
            });

            // Text overlay controls
            elements.addTextBtn.addEventListener('click', () => {
                state.textOverlay.enabled = true;
                elements.textControls.style.display = 'block';
                saveStateToHistory();
                render();
            });

            elements.textContent.addEventListener('input', (e) => {
                state.textOverlay.content = e.target.value;
                render();
            });

            elements.textSize.addEventListener('input', (e) => {
                state.textOverlay.size = parseInt(e.target.value);
                elements.textSizeValue.textContent = e.target.value;
                render();
            });

            elements.textFont.addEventListener('change', (e) => {
                state.textOverlay.font = e.target.value;
                render();
            });

            elements.textColor.addEventListener('input', (e) => {
                state.textOverlay.color = e.target.value;
                elements.textColorText.value = e.target.value;
                render();
            });

            elements.textColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    state.textOverlay.color = e.target.value;
                    elements.textColor.value = e.target.value;
                    render();
                }
            });

            elements.textBold.addEventListener('change', (e) => {
                state.textOverlay.bold = e.target.checked;
                render();
            });

            elements.textItalic.addEventListener('change', (e) => {
                state.textOverlay.italic = e.target.checked;
                render();
            });

            elements.removeTextBtn.addEventListener('click', () => {
                state.textOverlay.enabled = false;
                state.textOverlay.content = '';
                elements.textControls.style.display = 'none';
                elements.textContent.value = '';
                saveStateToHistory();
                render();
            });

            // Window overlay controls
            elements.windowOverlayEnabled.addEventListener('change', (e) => {
                state.windowOverlay.enabled = e.target.checked;
                elements.windowOverlayControls.style.display = e.target.checked ? 'block' : 'none';
                saveStateToHistory();
                render();
            });

            elements.windowOverlayStyle.addEventListener('change', (e) => {
                state.windowOverlay.style = e.target.value;
                render();
            });

            elements.windowOverlayTitle.addEventListener('input', (e) => {
                state.windowOverlay.title = e.target.value;
                render();
            });

            elements.windowOverlayHeight.addEventListener('input', (e) => {
                state.windowOverlay.height = parseInt(e.target.value);
                elements.windowOverlayHeightValue.textContent = e.target.value + 'px';
                render();
            });

            elements.windowShowControls.addEventListener('change', (e) => {
                state.windowOverlay.showControls = e.target.checked;
                render();
            });

            // Watermark controls
            elements.watermarkEnabled.addEventListener('change', (e) => {
                state.watermark.enabled = e.target.checked;
                elements.watermarkControls.style.display = e.target.checked ? 'block' : 'none';
                saveStateToHistory();
                render();
            });

            elements.watermarkText.addEventListener('input', (e) => {
                state.watermark.text = e.target.value;
                render();
            });

            elements.watermarkPosition.addEventListener('change', (e) => {
                state.watermark.position = e.target.value;
                render();
            });

            elements.watermarkSize.addEventListener('input', (e) => {
                state.watermark.size = parseInt(e.target.value);
                elements.watermarkSizeValue.textContent = e.target.value + 'px';
                render();
            });

            elements.watermarkOpacity.addEventListener('input', (e) => {
                state.watermark.opacity = parseInt(e.target.value);
                elements.watermarkOpacityValue.textContent = e.target.value + '%';
                render();
            });

            elements.watermarkColor.addEventListener('input', (e) => {
                state.watermark.color = e.target.value;
                elements.watermarkColorText.value = e.target.value;
                render();
            });

            elements.watermarkColorText.addEventListener('input', (e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    state.watermark.color = e.target.value;
                    elements.watermarkColor.value = e.target.value;
                    render();
                }
            });

            // Export controls
            elements.exportFormat.addEventListener('change', (e) => {
                state.exportSettings.format = e.target.value;
                elements.qualityControls.style.display = (e.target.value === 'jpeg' || e.target.value === 'webp') ? 'block' : 'none';
            });

            elements.exportQuality.addEventListener('input', (e) => {
                state.exportSettings.quality = parseInt(e.target.value);
                elements.exportQualityValue.textContent = e.target.value + '%';
            });

            elements.copyClipboardBtn.addEventListener('click', copyToClipboard);

            // Template controls
            elements.saveTemplateBtn.addEventListener('click', saveTemplate);
            elements.loadTemplateBtn.addEventListener('click', loadTemplate);
            elements.clearTemplatesBtn.addEventListener('click', clearTemplates);

            // Preset buttons
            document.querySelectorAll('.preset-button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.preset;
                    applyGradientPreset(preset);

                    document.querySelectorAll('.preset-button').forEach(b =>
                        b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Shadow preset buttons
            document.querySelectorAll('.shadow-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.shadow;
                    applyShadowPreset(preset);

                    document.querySelectorAll('.shadow-preset-btn').forEach(b =>
                        b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Size preset buttons
            document.querySelectorAll('.size-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const size = btn.dataset.size;
                    applySizePreset(size);

                    document.querySelectorAll('.size-preset-btn').forEach(b =>
                        b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }

        // File Handling
        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                loadImage(file);
            }
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
            elements.uploadZone.classList.add('drag-over');
        }

        function handleDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
            elements.uploadZone.classList.remove('drag-over');
        }

        function handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            elements.uploadZone.classList.remove('drag-over');

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                loadImage(file);
            }
        }

        function handlePaste(e) {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    loadImage(file);
                    break;
                }
            }
        }

        function loadImage(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    state.image = img;
                    state.svgCode = null;
                    elements.uploadZone.style.display = 'none';
                    elements.canvasWrapper.style.display = 'block';
                    saveStateToHistory();
                    render();
                    showNotification('Image loaded successfully!', 'success');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // SVG Code Handling
        function toggleSvgInput() {
            const isVisible = elements.svgInputContainer.style.display !== 'none';
            elements.svgInputContainer.style.display = isVisible ? 'none' : 'block';
        }

        function renderSvgCode() {
            const svgCode = elements.svgCodeInput.value.trim();
            if (!svgCode) {
                showNotification('Please enter SVG code', 'error');
                return;
            }

            let url = null;
            try {
                // Create a blob from the SVG code
                const blob = new Blob([svgCode], { type: 'image/svg+xml' });
                url = URL.createObjectURL(blob);

                const img = new Image();
                img.onload = () => {
                    state.image = img;
                    state.svgCode = svgCode;
                    elements.uploadZone.style.display = 'none';
                    elements.canvasWrapper.style.display = 'block';
                    elements.svgInputContainer.style.display = 'none';
                    saveStateToHistory();
                    render();
                    showNotification('SVG rendered successfully!', 'success');
                    if (url) URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    showNotification('Invalid SVG code', 'error');
                    if (url) URL.revokeObjectURL(url);
                };
                img.src = url;
            } catch (error) {
                // Clean up URL if exception occurs before handlers are set
                if (url) URL.revokeObjectURL(url);
                showNotification('Error rendering SVG: ' + error.message, 'error');
            }
        }

        // Gradient Functions
        function applyGradientPreset(presetName) {
            const preset = gradientPresets[presetName];
            if (preset) {
                saveStateToHistory();
                state.gradient.colors = [...preset.colors];
                state.gradient.positions = [...preset.positions];
                state.gradient.angle = preset.angle;

                // Update UI
                elements.gradientColor1.value = preset.colors[0];
                elements.gradientColor2.value = preset.colors[1];
                elements.gradientPos1.value = preset.positions[0];
                elements.gradientPos2.value = preset.positions[1];
                elements.gradientAngle.value = preset.angle;

                elements.gradientPos1Value.textContent = `${preset.positions[0]}%`;
                elements.gradientPos2Value.textContent = `${preset.positions[1]}%`;
                elements.gradientAngleValue.textContent = `${preset.angle}°`;

                updateAngleIndicator();
                updateGradientPreview();
                render();
            }
        }

        function updateGradientPreview() {
            const preview = elements.gradientPreview;
            const gradient = createGradientString();
            preview.style.background = gradient;
        }

        function createGradientString() {
            const { type, angle, colors, positions } = state.gradient;

            if (type === 'linear') {
                return `linear-gradient(${angle}deg, ${colors[0]} ${positions[0]}%, ${colors[1]} ${positions[1]}%)`;
            } else {
                return `radial-gradient(circle, ${colors[0]} ${positions[0]}%, ${colors[1]} ${positions[1]}%)`;
            }
        }

        function updateAngleIndicator() {
            const angle = state.gradient.angle;
            elements.angleIndicator.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
        }

        // Shadow Functions
        function applyShadowPreset(presetName) {
            const preset = shadowPresets[presetName];
            if (preset) {
                saveStateToHistory();
                state.shadow = { ...state.shadow, ...preset };

                // Update UI
                elements.shadowBlur.value = preset.blur;
                elements.shadowSpread.value = preset.spread;
                elements.shadowOpacity.value = preset.opacity;
                elements.shadowX.value = preset.x;
                elements.shadowY.value = preset.y;

                elements.shadowBlurValue.textContent = `${preset.blur}px`;
                elements.shadowSpreadValue.textContent = `${preset.spread}px`;
                elements.shadowOpacityValue.textContent = `${preset.opacity}%`;
                elements.shadowXValue.textContent = `${preset.x}px`;
                elements.shadowYValue.textContent = `${preset.y}px`;

                render();
            }
        }

        // Size Preset Functions
        function applySizePreset(presetName) {
            const preset = sizePresets[presetName];
            if (preset) {
                saveStateToHistory();
                state.canvas.width = preset.width;
                state.canvas.height = preset.height;

                // Update UI
                elements.canvasWidth.value = preset.width;
                elements.canvasHeight.value = preset.height;

                render();
            }
        }

        // Render Function
        function render() {
            if (!state.image) return;

            const canvas = elements.canvas;
            canvas.width = state.canvas.width;
            canvas.height = state.canvas.height;

            // Draw gradient background
            drawGradient();

            // Calculate image dimensions with padding and scale
            const scaleFactor = state.scale / 100;
            const padding = state.padding * 2;

            // Account for window overlay title bar
            const titleBarHeight = state.windowOverlay.enabled ? state.windowOverlay.height : 0;

            const availableWidth = canvas.width - padding;
            const availableHeight = canvas.height - padding - titleBarHeight;

            let imgWidth = state.image.width * scaleFactor;
            let imgHeight = state.image.height * scaleFactor;

            // Validate image dimensions to prevent division by zero
            if (imgWidth <= 0 || imgHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
                console.error('Invalid image or canvas dimensions');
                return;
            }

            // Fit image within available space
            const imgRatio = imgWidth / imgHeight;
            const availableRatio = availableWidth / availableHeight;

            if (imgRatio > availableRatio) {
                // Image is wider
                if (imgWidth > availableWidth) {
                    imgWidth = availableWidth;
                    imgHeight = imgWidth / imgRatio;
                }
            } else {
                // Image is taller
                if (imgHeight > availableHeight) {
                    imgHeight = availableHeight;
                    imgWidth = imgHeight * imgRatio;
                }
            }

            const x = (canvas.width - imgWidth) / 2;
            const y = (canvas.height - imgHeight - titleBarHeight) / 2 + titleBarHeight;

            // Draw shadow
            if (state.shadow.opacity > 0) {
                drawShadow(x, y, imgWidth, imgHeight);
            }

            // Draw image with border radius, transforms, and filters
            ctx.save();

            // Create rounded rectangle path
            const radius = state.borderRadius;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + imgWidth - radius, y);
            ctx.quadraticCurveTo(x + imgWidth, y, x + imgWidth, y + radius);
            ctx.lineTo(x + imgWidth, y + imgHeight - radius);
            ctx.quadraticCurveTo(x + imgWidth, y + imgHeight, x + imgWidth - radius, y + imgHeight);
            ctx.lineTo(x + radius, y + imgHeight);
            ctx.quadraticCurveTo(x, y + imgHeight, x, y + imgHeight - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.clip();

            // Apply transforms and filters
            const centerX = x + imgWidth / 2;
            const centerY = y + imgHeight / 2;

            ctx.translate(centerX, centerY);

            // Apply rotation
            if (state.imageTransform.rotation !== 0) {
                ctx.rotate((state.imageTransform.rotation * Math.PI) / 180);
            }

            // Apply flip
            const scaleX = state.imageTransform.flipH ? -1 : 1;
            const scaleY = state.imageTransform.flipV ? -1 : 1;
            ctx.scale(scaleX, scaleY);

            // Apply CSS filters
            const filters = [];
            if (state.imageFilters.brightness !== 100) {
                filters.push(`brightness(${state.imageFilters.brightness}%)`);
            }
            if (state.imageFilters.contrast !== 100) {
                filters.push(`contrast(${state.imageFilters.contrast}%)`);
            }
            if (state.imageFilters.saturation !== 100) {
                filters.push(`saturate(${state.imageFilters.saturation}%)`);
            }
            if (state.imageFilters.blur > 0) {
                filters.push(`blur(${state.imageFilters.blur}px)`);
            }
            if (state.imageFilters.grayscale > 0) {
                filters.push(`grayscale(${state.imageFilters.grayscale}%)`);
            }
            if (state.imageFilters.sepia > 0) {
                filters.push(`sepia(${state.imageFilters.sepia}%)`);
            }
            if (filters.length > 0) {
                ctx.filter = filters.join(' ');
            }

            // Adjust drawing position for rotation
            let drawWidth = imgWidth;
            let drawHeight = imgHeight;
            if (state.imageTransform.rotation === 90 || state.imageTransform.rotation === 270) {
                drawWidth = imgHeight;
                drawHeight = imgWidth;
            }

            // Draw image centered
            ctx.drawImage(state.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

            ctx.restore();

            // Draw border if enabled
            if (state.showBorder) {
                drawBorder(x, y, imgWidth, imgHeight);
            }

            // Draw window overlay
            if (state.windowOverlay.enabled) {
                // Calculate window position (title bar starts above the image)
                const windowY = y - state.windowOverlay.height;
                const windowHeight = imgHeight + state.windowOverlay.height;
                drawMacOSWindow(x, windowY, imgWidth, windowHeight);
            }

            // Draw text overlay
            drawTextOverlay();

            // Draw watermark
            drawWatermark();
        }

        function drawGradient() {
            let gradient;

            if (state.gradient.type === 'linear') {
                const angle = state.gradient.angle * Math.PI / 180;
                const x1 = elements.canvas.width / 2 + Math.cos(angle) * elements.canvas.width;
                const y1 = elements.canvas.height / 2 + Math.sin(angle) * elements.canvas.height;
                const x2 = elements.canvas.width / 2 - Math.cos(angle) * elements.canvas.width;
                const y2 = elements.canvas.height / 2 - Math.sin(angle) * elements.canvas.height;

                gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            } else {
                const centerX = elements.canvas.width / 2;
                const centerY = elements.canvas.height / 2;
                const radius = Math.max(elements.canvas.width, elements.canvas.height) / 2;

                gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            }

            gradient.addColorStop(state.gradient.positions[0] / 100, state.gradient.colors[0]);
            gradient.addColorStop(state.gradient.positions[1] / 100, state.gradient.colors[1]);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
        }

        function drawShadow(x, y, width, height) {
            const shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = elements.canvas.width;
            shadowCanvas.height = elements.canvas.height;
            const shadowCtx = shadowCanvas.getContext('2d');

            // Convert hex color to rgba with validation
            const shadowColor = state.shadow.color;
            const opacity = state.shadow.opacity / 100;

            // Validate hex color format
            const hexMatch = shadowColor.match(/^#([0-9A-Fa-f]{6})$/);
            if (!hexMatch) {
                console.warn('Invalid shadow color, using default black');
                shadowCtx.shadowColor = `rgba(0, 0, 0, ${opacity})`;
            } else {
                const r = parseInt(shadowColor.slice(1, 3), 16);
                const g = parseInt(shadowColor.slice(3, 5), 16);
                const b = parseInt(shadowColor.slice(5, 7), 16);
                shadowCtx.shadowColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }

            shadowCtx.shadowBlur = state.shadow.blur;
            shadowCtx.shadowOffsetX = state.shadow.x;
            shadowCtx.shadowOffsetY = state.shadow.y;

            // Draw shadow shape
            const radius = state.borderRadius;
            const spread = state.shadow.spread;
            const shadowX = x - spread;
            const shadowY = y - spread;
            const shadowWidth = width + spread * 2;
            const shadowHeight = height + spread * 2;

            shadowCtx.fillStyle = 'black';
            shadowCtx.beginPath();
            shadowCtx.moveTo(shadowX + radius, shadowY);
            shadowCtx.lineTo(shadowX + shadowWidth - radius, shadowY);
            shadowCtx.quadraticCurveTo(shadowX + shadowWidth, shadowY, shadowX + shadowWidth, shadowY + radius);
            shadowCtx.lineTo(shadowX + shadowWidth, shadowY + shadowHeight - radius);
            shadowCtx.quadraticCurveTo(shadowX + shadowWidth, shadowY + shadowHeight,
                shadowX + shadowWidth - radius, shadowY + shadowHeight);
            shadowCtx.lineTo(shadowX + radius, shadowY + shadowHeight);
            shadowCtx.quadraticCurveTo(shadowX, shadowY + shadowHeight, shadowX, shadowY + shadowHeight - radius);
            shadowCtx.lineTo(shadowX, shadowY + radius);
            shadowCtx.quadraticCurveTo(shadowX, shadowY, shadowX + radius, shadowY);
            shadowCtx.closePath();
            shadowCtx.fill();

            ctx.drawImage(shadowCanvas, 0, 0);
        }

        function drawBorder(x, y, width, height) {
            ctx.strokeStyle = state.borderColor;
            ctx.lineWidth = state.borderWidth;

            const radius = state.borderRadius;
            const offset = state.borderWidth / 2;

            ctx.beginPath();
            ctx.moveTo(x + radius, y + offset);
            ctx.lineTo(x + width - radius, y + offset);
            ctx.quadraticCurveTo(x + width - offset, y + offset, x + width - offset, y + radius);
            ctx.lineTo(x + width - offset, y + height - radius);
            ctx.quadraticCurveTo(x + width - offset, y + height - offset,
                x + width - radius, y + height - offset);
            ctx.lineTo(x + radius, y + height - offset);
            ctx.quadraticCurveTo(x + offset, y + height - offset, x + offset, y + height - radius);
            ctx.lineTo(x + offset, y + radius);
            ctx.quadraticCurveTo(x + offset, y + offset, x + radius, y + offset);
            ctx.closePath();
            ctx.stroke();
        }

        // Draw Text Overlay
        function drawTextOverlay() {
            if (!state.textOverlay.enabled || !state.textOverlay.content) return;

            ctx.save();

            // Build font string
            let fontStyle = '';
            if (state.textOverlay.italic) fontStyle += 'italic ';
            if (state.textOverlay.bold) fontStyle += 'bold ';
            ctx.font = `${fontStyle}${state.textOverlay.size}px ${state.textOverlay.font}`;

            // Set text properties
            ctx.fillStyle = state.textOverlay.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Calculate position (x and y are percentages 0-1)
            const x = elements.canvas.width * state.textOverlay.x;
            const y = elements.canvas.height * state.textOverlay.y;

            // Draw text
            ctx.fillText(state.textOverlay.content, x, y);

            ctx.restore();
        }

        // Draw macOS Window Overlay
        function drawMacOSWindow(x, y, width, height) {
            const titleBarHeight = state.windowOverlay.height;
            const radius = state.borderRadius;

            ctx.save();

            // Draw title bar background
            const titleBarGradient = ctx.createLinearGradient(x, y, x, y + titleBarHeight);
            titleBarGradient.addColorStop(0, '#ececec');
            titleBarGradient.addColorStop(1, '#d6d6d6');
            ctx.fillStyle = titleBarGradient;

            // Title bar with top rounded corners
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + titleBarHeight);
            ctx.lineTo(x, y + titleBarHeight);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();

            // Draw title bar border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + titleBarHeight);
            ctx.lineTo(x + width, y + titleBarHeight);
            ctx.stroke();

            // Draw window controls (traffic lights) if enabled
            if (state.windowOverlay.showControls) {
                const buttonY = y + titleBarHeight / 2;
                const buttonSpacing = 20;
                const buttonRadius = 6;
                const startX = x + 12;

                // Red button (close)
                ctx.fillStyle = '#ff5f57';
                ctx.beginPath();
                ctx.arc(startX, buttonY, buttonRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#e04038';
                ctx.lineWidth = 0.5;
                ctx.stroke();

                // Yellow button (minimize)
                ctx.fillStyle = '#ffbd2e';
                ctx.beginPath();
                ctx.arc(startX + buttonSpacing, buttonY, buttonRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#dea123';
                ctx.lineWidth = 0.5;
                ctx.stroke();

                // Green button (maximize)
                ctx.fillStyle = '#28ca42';
                ctx.beginPath();
                ctx.arc(startX + buttonSpacing * 2, buttonY, buttonRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#1fa935';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            // Draw window title
            if (state.windowOverlay.title) {
                ctx.fillStyle = '#333333';
                ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(state.windowOverlay.title, x + width / 2, y + titleBarHeight / 2);
            }

            ctx.restore();
        }

        // Draw Watermark
        function drawWatermark() {
            if (!state.watermark.enabled || !state.watermark.text) return;

            ctx.save();

            // Set watermark properties
            ctx.font = `${state.watermark.size}px Arial`;
            ctx.fillStyle = state.watermark.color;
            const opacity = state.watermark.opacity / 100;
            ctx.globalAlpha = opacity;

            // Calculate position
            const padding = 20;
            let x, y;
            const textMetrics = ctx.measureText(state.watermark.text);
            const textWidth = textMetrics.width;
            const textHeight = state.watermark.size;

            switch (state.watermark.position) {
                case 'bottom-right':
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    x = elements.canvas.width - padding;
                    y = elements.canvas.height - padding;
                    break;
                case 'bottom-left':
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    x = padding;
                    y = elements.canvas.height - padding;
                    break;
                case 'top-right':
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    x = elements.canvas.width - padding;
                    y = padding;
                    break;
                case 'top-left':
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    x = padding;
                    y = padding;
                    break;
                case 'center':
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    x = elements.canvas.width / 2;
                    y = elements.canvas.height / 2;
                    break;
            }

            // Draw watermark
            ctx.fillText(state.watermark.text, x, y);

            ctx.restore();
        }

        // Export Function
        function exportImage() {
            if (!state.image) {
                showNotification('Please load an image first!', 'error');
                return;
            }

            // Determine MIME type and file extension
            let mimeType, extension;
            let quality = state.exportSettings.quality / 100;

            switch (state.exportSettings.format) {
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    extension = 'jpg';
                    break;
                case 'webp':
                    mimeType = 'image/webp';
                    extension = 'webp';
                    break;
                case 'png':
                default:
                    mimeType = 'image/png';
                    extension = 'png';
                    break;
            }

            // PNG doesn't use quality parameter
            const blobCallback = (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `screenshot-${Date.now()}.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showNotification(`Image exported as ${extension.toUpperCase()}!`, 'success');
            };

            if (mimeType === 'image/png') {
                elements.canvas.toBlob(blobCallback, mimeType);
            } else {
                elements.canvas.toBlob(blobCallback, mimeType, quality);
            }
        }

        // Copy to Clipboard Function
        function copyToClipboard() {
            if (!state.image) {
                showNotification('Please load an image first!', 'error');
                return;
            }

            elements.canvas.toBlob((blob) => {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(() => {
                    showNotification('Image copied to clipboard!', 'success');
                }).catch((error) => {
                    showNotification('Failed to copy to clipboard: ' + error.message, 'error');
                });
            }, 'image/png');
        }

        // Template Functions
        function saveTemplate() {
            const templateName = elements.templateName.value.trim();
            if (!templateName) {
                showNotification('Please enter a template name!', 'error');
                return;
            }

            // Get all templates from localStorage
            let templates = {};
            try {
                const saved = localStorage.getItem('snapshotpro_templates');
                if (saved) {
                    templates = JSON.parse(saved);
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            }

            // Save current settings as template
            templates[templateName] = {
                imageTransform: state.imageTransform,
                imageFilters: state.imageFilters,
                textOverlay: state.textOverlay,
                windowOverlay: state.windowOverlay,
                watermark: state.watermark,
                gradient: state.gradient,
                padding: state.padding,
                scale: state.scale,
                borderRadius: state.borderRadius,
                showBorder: state.showBorder,
                borderWidth: state.borderWidth,
                borderColor: state.borderColor,
                shadow: state.shadow,
                canvas: state.canvas,
                exportSettings: state.exportSettings
            };

            // Save to localStorage
            try {
                localStorage.setItem('snapshotpro_templates', JSON.stringify(templates));
                updateTemplateList();
                showNotification(`Template "${templateName}" saved!`, 'success');
                elements.templateName.value = '';
            } catch (error) {
                showNotification('Error saving template: ' + error.message, 'error');
            }
        }

        function loadTemplate() {
            const templateName = elements.templateList.value;
            if (!templateName) {
                showNotification('Please select a template!', 'error');
                return;
            }

            try {
                const saved = localStorage.getItem('snapshotpro_templates');
                if (!saved) {
                    showNotification('No templates found!', 'error');
                    return;
                }

                const templates = JSON.parse(saved);
                const template = templates[templateName];

                if (!template) {
                    showNotification('Template not found!', 'error');
                    return;
                }

                // Apply template to state
                saveStateToHistory();
                Object.assign(state, template);
                updateUIFromState();

                // Only render if an image is loaded
                if (state.image) {
                    render();
                }

                showNotification(`Template "${templateName}" loaded!`, 'success');
            } catch (error) {
                showNotification('Error loading template: ' + error.message, 'error');
            }
        }

        function clearTemplates() {
            if (!confirm('Are you sure you want to delete all templates? This cannot be undone.')) {
                return;
            }

            try {
                localStorage.removeItem('snapshotpro_templates');
                updateTemplateList();
                showNotification('All templates cleared!', 'success');
            } catch (error) {
                showNotification('Error clearing templates: ' + error.message, 'error');
            }
        }

        function updateTemplateList() {
            // Clear current options (except the default)
            elements.templateList.innerHTML = '<option value="">-- Select Template --</option>';

            try {
                const saved = localStorage.getItem('snapshotpro_templates');
                if (!saved) {
                    elements.templateInfo.textContent = 'No templates saved';
                    return;
                }

                const templates = JSON.parse(saved);
                const templateNames = Object.keys(templates);

                if (templateNames.length === 0) {
                    elements.templateInfo.textContent = 'No templates saved';
                    return;
                }

                // Add template options
                templateNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    elements.templateList.appendChild(option);
                });

                elements.templateInfo.textContent = `${templateNames.length} template${templateNames.length > 1 ? 's' : ''} saved`;
            } catch (error) {
                console.error('Error updating template list:', error);
                elements.templateInfo.textContent = 'Error loading templates';
            }
        }

        // Reset Function
        function resetToDefaults() {
            // Reset state
            state.imageTransform = {
                rotation: 0,
                flipH: false,
                flipV: false
            };
            state.imageFilters = {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                blur: 0,
                grayscale: 0,
                sepia: 0
            };
            state.textOverlay = {
                enabled: false,
                content: '',
                size: 48,
                font: 'Arial',
                color: '#ffffff',
                bold: false,
                italic: false,
                x: 0.5,
                y: 0.5
            };
            state.windowOverlay = {
                enabled: false,
                style: 'macos',
                title: 'Screenshot',
                height: 40,
                showControls: true
            };
            state.watermark = {
                enabled: false,
                text: '',
                position: 'bottom-right',
                size: 16,
                opacity: 50,
                color: '#ffffff'
            };
            state.exportSettings = {
                format: 'png',
                quality: 92
            };
            state.gradient = {
                type: 'linear',
                angle: 135,
                colors: ['#667eea', '#764ba2'],
                positions: [0, 100]
            };
            state.padding = 60;
            state.scale = 100;
            state.borderRadius = 12;
            state.showBorder = false;
            state.borderWidth = 2;
            state.borderColor = '#ffffff';
            state.shadow = {
                blur: 40,
                spread: 10,
                opacity: 30,
                x: 0,
                y: 10,
                color: '#000000'
            };
            state.canvas = {
                width: 1200,
                height: 675
            };

            // Update all UI elements
            elements.brightness.value = 100;
            elements.brightnessValue.textContent = '100%';
            elements.contrast.value = 100;
            elements.contrastValue.textContent = '100%';
            elements.saturation.value = 100;
            elements.saturationValue.textContent = '100%';
            elements.blur.value = 0;
            elements.blurValue.textContent = '0px';
            elements.grayscale.value = 0;
            elements.grayscaleValue.textContent = '0%';
            elements.sepia.value = 0;
            elements.sepiaValue.textContent = '0%';

            elements.gradientType.value = 'linear';
            elements.gradientAngle.value = 135;
            elements.gradientAngleValue.textContent = '135°';
            elements.gradientColor1.value = '#667eea';
            elements.gradientColor2.value = '#764ba2';
            elements.gradientPos1.value = 0;
            elements.gradientPos2.value = 100;
            elements.gradientPos1Value.textContent = '0%';
            elements.gradientPos2Value.textContent = '100%';

            elements.padding.value = 60;
            elements.paddingValue.textContent = '60px';
            elements.scale.value = 100;
            elements.scaleValue.textContent = '100%';
            elements.borderRadius.value = 12;
            elements.borderRadiusValue.textContent = '12px';
            elements.showBorder.checked = false;
            elements.borderControls.style.display = 'none';
            elements.borderWidth.value = 2;
            elements.borderWidthValue.textContent = '2px';
            elements.borderColor.value = '#ffffff';
            elements.borderColorText.value = '#ffffff';

            elements.shadowBlur.value = 40;
            elements.shadowBlurValue.textContent = '40px';
            elements.shadowSpread.value = 10;
            elements.shadowSpreadValue.textContent = '10px';
            elements.shadowOpacity.value = 30;
            elements.shadowOpacityValue.textContent = '30%';
            elements.shadowX.value = 0;
            elements.shadowXValue.textContent = '0px';
            elements.shadowY.value = 10;
            elements.shadowYValue.textContent = '10px';
            elements.shadowColor.value = '#000000';
            elements.shadowColorText.value = '#000000';

            elements.canvasWidth.value = 1200;
            elements.canvasHeight.value = 675;

            // Text overlay
            elements.textControls.style.display = 'none';
            elements.textContent.value = '';
            elements.textSize.value = 48;
            elements.textSizeValue.textContent = '48';
            elements.textFont.value = 'Arial';
            elements.textColor.value = '#ffffff';
            elements.textColorText.value = '#ffffff';
            elements.textBold.checked = false;
            elements.textItalic.checked = false;

            // Window overlay
            elements.windowOverlayEnabled.checked = false;
            elements.windowOverlayControls.style.display = 'none';
            elements.windowOverlayStyle.value = 'macos';
            elements.windowOverlayTitle.value = 'Screenshot';
            elements.windowOverlayHeight.value = 40;
            elements.windowOverlayHeightValue.textContent = '40px';
            elements.windowShowControls.checked = true;

            // Watermark
            elements.watermarkEnabled.checked = false;
            elements.watermarkControls.style.display = 'none';
            elements.watermarkText.value = '';
            elements.watermarkPosition.value = 'bottom-right';
            elements.watermarkSize.value = 16;
            elements.watermarkSizeValue.textContent = '16px';
            elements.watermarkOpacity.value = 50;
            elements.watermarkOpacityValue.textContent = '50%';
            elements.watermarkColor.value = '#ffffff';
            elements.watermarkColorText.value = '#ffffff';

            // Export settings
            elements.exportFormat.value = 'png';
            elements.qualityControls.style.display = 'none';
            elements.exportQuality.value = 92;
            elements.exportQualityValue.textContent = '92%';

            // Reset active buttons
            document.querySelectorAll('.preset-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.shadow-preset-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.size-preset-btn').forEach(b => b.classList.remove('active'));

            document.querySelector('.preset-button[data-preset="sunset"]').classList.add('active');
            document.querySelector('.shadow-preset-btn[data-shadow="soft"]').classList.add('active');

            updateAngleIndicator();
            updateGradientPreview();
            render();

            showNotification('Settings reset to defaults!', 'success');
        }

        // Notification Function
        function showNotification(message, type = 'success') {
            elements.notificationText.textContent = message;
            elements.notification.className = `notification ${type}`;
            elements.notification.classList.add('show');

            setTimeout(() => {
                elements.notification.classList.remove('show');
            }, 3000);
        }

        // Initialize Application
        function init() {
            setupEventListeners();
            updateAngleIndicator();
            updateGradientPreview();
            updateTemplateList();

            // Set active defaults
            document.querySelector('.preset-button[data-preset="sunset"]').classList.add('active');
            document.querySelector('.shadow-preset-btn[data-shadow="soft"]').classList.add('active');
        }

        // Start the application
        init();
    </script>

import { Cursor } from "./cursor.js";
import { monospaceFamily } from "./fonts.js"
import { Row } from "./row.js";
import { Dark as DefaultTheme } from "./themes.js";
import { TimedEvent } from "./timedEvent.js";

import {
    clear,
    canvas,
    assignAttributes,
    isCanvas,
    offscreenCanvas,
    setContextSize,
    resizeContext
} from "./html.js";

import {
    isFirefox,
    isApple,
    isDebug
} from "./flags.js";

import {
    Point,
    Size,
    Rectangle
} from "./geom.js";

import {
    Windows,
    MacOS
} from "./os.js";

import {
    JavaScript,
    grammars
} from "./grammars.js";

import {
    singleLineOutput,
    multiLineOutput,
    singleLineInput,
    multiLineInput
} from "./controlTypes.js";

//>>>>>>>>>> PRIVATE STATIC FIELDS >>>>>>>>>>
let elementCounter = 0,
    focusedControl = null,
    hoveredControl = null,
    publicControls = [];

const wheelScrollSpeed = 4,
    vScrollWidth = 2,
    scrollScale = isFirefox ? 3 : 100,
    optionDefaults = Object.freeze({
        readOnly: false,
        multiLine: true,
        wordWrap: true,
        scrollBars: true,
        lineNumbers: true,
        padding: 0,
        fontSize: 16,
        language: "JavaScript",
        scaleFactor: devicePixelRatio
    }),
    controls = [],
    elements = new WeakMap(),
    ready = (document.readyState === "complete"
        ? Promise.resolve("already")
        : new Promise((resolve) => {
            document.addEventListener("readystatechange", (evt) => {
                if (document.readyState === "complete") {
                    resolve("had to wait for it");
                }
            }, false);
        }))
        .then(() => {
            for (let element of document.getElementsByTagName("primrose")) {
                new Primrose({
                    element
                });
            }
        });

//<<<<<<<<<< PRIVATE STATIC FIELDS <<<<<<<<<<

export class Primrose extends EventTarget {
    constructor(options) {
        super();

        const debugEvt = (name, callback, debugLocal) => {
            return (evt) => {
                if (isDebug || debugLocal) {
                    console.log(`Primrose #${elementID}`, name, evt);
                }

                if (!!callback) {
                    callback(evt);
                }
            };
        };

        //>>>>>>>>>> VALIDATE PARAMETERS >>>>>>>>>>
        options = options || {};

        if (options.element === undefined) {
            options.element = null;
        }

        if (options.element !== null
            && !(options.element instanceof HTMLElement)) {
            throw new Error("element must be null, an instance of HTMLElement, an instance of HTMLCanvaseElement, or an instance of OffscreenCanvas");
        }

        options = Object.assign({}, optionDefaults, options);
        //<<<<<<<<<< VALIDATE PARAMETERS <<<<<<<<<<


        //>>>>>>>>>> PRIVATE METHODS >>>>>>>>>>
        //>>>>>>>>>> RENDERING >>>>>>>>>>
        let render = () => {
            // do nothing, disabling rendering until the object is fully initialized;
        };

        const fillRect = (gfx, fill, x, y, w, h) => {
            gfx.fillStyle = fill;
            gfx.fillRect(
                x * character.width,
                y * character.height,
                w * character.width + 1,
                h * character.height + 1);
        };

        const strokeRect = (gfx, stroke, x, y, w, h) => {
            gfx.strokeStyle = stroke;
            gfx.strokeRect(
                x * character.width,
                y * character.height,
                w * character.width + 1,
                h * character.height + 1);
        };

        const renderCanvasBackground = () => {
            const minCursor = Cursor.min(frontCursor, backCursor),
                maxCursor = Cursor.max(frontCursor, backCursor),
                clearFunc = theme.regular.backColor ? "fillRect" : "clearRect";

            if (clearFunc === "fillRect") {
                bgfx.fillStyle = theme.regular.backColor;
            }
            bgfx[clearFunc](0, 0, canv.width, canv.height);
            bgfx.save();
            bgfx.scale(scaleFactor, scaleFactor);
            bgfx.translate(
                (gridBounds.x - scroll.x) * character.width + padding,
                -scroll.y * character.height + padding);


            // draw current row highlighter
            if (focused) {
                fillRect(bgfx, theme.currentRowBackColor ||
                    DefaultTheme.currentRowBackColor,
                    0, minCursor.y,
                    this.width,
                    maxCursor.y - minCursor.y + 1);
            }

            const minY = scroll.y | 0,
                maxY = minY + gridBounds.height,
                minX = scroll.x | 0,
                maxX = minX + gridBounds.width;
            tokenFront.setXY(rows, 0, minY);
            tokenBack.copy(tokenFront);
            for (let y = minY; y <= maxY && y < rows.length; ++y) {
                // draw the tokens on this row
                const row = rows[y].tokens;
                for (let i = 0; i < row.length; ++i) {
                    const t = row[i];
                    tokenBack.x += t.length;
                    tokenBack.i += t.length;

                    // skip drawing tokens that aren't in view
                    if (minX <= tokenBack.x && tokenFront.x <= maxX) {
                        // draw the selection box
                        const inSelection = minCursor.i <= tokenBack.i
                            && tokenFront.i < maxCursor.i;
                        if (inSelection && focused) {
                            const selectionFront = Cursor.max(minCursor, tokenFront),
                                selectionBack = Cursor.min(maxCursor, tokenBack),
                                cw = selectionBack.i - selectionFront.i;
                            fillRect(bgfx, theme.selectedBackColor ||
                                DefaultTheme.selectedBackColor,
                                selectionFront.x, selectionFront.y,
                                cw, 1);
                        }
                    }

                    tokenFront.copy(tokenBack);
                }

                tokenFront.x = 0;
                ++tokenFront.y;
                tokenBack.copy(tokenFront);
            }

            // draw cursor caret
            if (focused) {
                const cc = theme.cursorColor || DefaultTheme.cursorColor,
                    w = 0;
                fillRect(bgfx, cc, minCursor.x, minCursor.y, w, 1);
                fillRect(bgfx, cc, maxCursor.x, maxCursor.y, w, 1);
            }
            bgfx.restore();
        };

        const renderCanvasForeground = () => {
            fgfx.clearRect(0, 0, canv.width, canv.height);
            fgfx.save();
            fgfx.scale(scaleFactor, scaleFactor);
            fgfx.translate(
                (gridBounds.x - scroll.x) * character.width + padding,
                padding);
            const minY = scroll.y | 0,
                maxY = minY + gridBounds.height,
                minX = scroll.x | 0,
                maxX = minX + gridBounds.width;
            tokenFront.setXY(rows, 0, minY);
            tokenBack.copy(tokenFront);
            for (let y = minY; y <= maxY && y < rows.length; ++y) {
                // draw the tokens on this row
                const row = rows[y].tokens,
                    textY = (y - scroll.y) * character.height - 4;

                for (let i = 0; i < row.length; ++i) {
                    const t = row[i];
                    tokenBack.x += t.length;
                    tokenBack.i += t.length;

                    // skip drawing tokens that aren't in view
                    if (minX <= tokenBack.x && tokenFront.x <= maxX) {

                        // draw the text
                        const style = theme[t.type] || {},
                            fontWeight = style.fontWeight
                                || theme.regular.fontWeight
                                || DefaultTheme.regular.fontWeight
                                || "",
                            fontStyle = style.fontStyle
                                || theme.regular.fontStyle
                                || DefaultTheme.regular.fontStyle
                                || "",
                            font = `${fontWeight} ${fontStyle} ${context.font}`;
                        fgfx.font = font.trim();
                        fgfx.fillStyle = style.foreColor || theme.regular.foreColor;
                        fgfx.fillText(
                            t.value,
                            tokenFront.x * character.width,
                            textY);
                    }

                    tokenFront.copy(tokenBack);
                }

                tokenFront.x = 0;
                ++tokenFront.y;
                tokenBack.copy(tokenFront);
            }

            fgfx.restore();
        };

        const renderCanvasTrim = () => {
            tgfx.clearRect(0, 0, canv.width, canv.height);
            tgfx.save();
            tgfx.scale(scaleFactor, scaleFactor);
            tgfx.translate(padding, padding);

            if (showLineNumbers) {
                fillRect(tgfx,
                    theme.selectedBackColor ||
                    DefaultTheme.selectedBackColor,
                    0, 0,
                    gridBounds.x, this.width - padding * 2);
                strokeRect(tgfx,
                    theme.regular.foreColor ||
                    DefaultTheme.regular.foreColor,
                    0, 0,
                    gridBounds.x, this.height - padding * 2);
            }

            let maxRowWidth = 2;
            tgfx.save();
            {
                tgfx.translate((lineCountWidth - 0.5) * character.width, -scroll.y * character.height);
                let lastLineNumber = -1;
                const minY = scroll.y | 0,
                    maxY = minY + gridBounds.height,
                    minX = scroll.x | 0,
                    maxX = minX + gridBounds.width;
                tokenFront.setXY(rows, 0, minY);
                tokenBack.copy(tokenFront);
                for (let y = minY; y <= maxY && y < rows.length; ++y) {
                    const row = rows[y];
                    maxRowWidth = Math.max(maxRowWidth, row.stringLength);
                    if (showLineNumbers) {
                        // draw the left gutter
                        if (row.lineNumber > lastLineNumber) {
                            lastLineNumber = row.lineNumber;
                            tgfx.font = "bold " + context.font;
                            tgfx.fillStyle = theme.regular.foreColor;
                            tgfx.fillText(
                                row.lineNumber,
                                0, y * character.height);
                        }
                    }
                }
            }
            tgfx.restore();

            // draw scrollbars
            if (showScrollBars && focused) {
                tgfx.fillStyle = theme.selectedBackColor ||
                    DefaultTheme.selectedBackColor;

                // horizontal
                if (!wordWrap && maxRowWidth > gridBounds.width) {
                    const drawWidth = gridBounds.width * character.width - padding,
                        scrollX = (scroll.x * drawWidth) / maxRowWidth + gridBounds.x * character.width,
                        scrollBarWidth = drawWidth * (gridBounds.width / maxRowWidth),
                        by = this.height - 4 - padding,
                        bw = Math.max(4, scrollBarWidth);
                    tgfx.fillRect(scrollX, by, bw, 4);
                    tgfx.strokeRect(scrollX, by, bw, 4);
                }

                //vertical
                if (rows.length > gridBounds.height) {
                    const drawHeight = gridBounds.height * character.height,
                        scrollY = (scroll.y * drawHeight) / rows.length,
                        scrollBarHeight = drawHeight * (gridBounds.height / rows.length),
                        bx = this.width - vScrollWidth * 2 - 2 * padding,
                        bw = vScrollWidth * 2,
                        bh = Math.max(4, scrollBarHeight);
                    tgfx.fillRect(bx, scrollY, bw, bh);
                    tgfx.strokeRect(bx, scrollY, bw, bh);
                }
            }

            tgfx.restore();
            if (!focused) {
                tgfx.fillStyle = theme.unfocused || DefaultTheme.unfocused;
                tgfx.fillRect(0, 0, canv.width, canv.height);
            }
        };

        const doRender = () => {
            if (theme) {
                const textChanged = lastText !== value,
                    focusChanged = focused !== lastFocused,
                    fontChanged = context.font !== lastFont,
                    paddingChanged = padding !== lastPadding,
                    themeChanged = theme.name !== lastThemeName,
                    boundsChanged = gridBounds.toString() !== lastGridBounds,
                    characterWidthChanged = character.width !== lastCharacterWidth,
                    characterHeightChanged = character.height !== lastCharacterHeight,

                    cursorChanged = frontCursor.i !== lastFrontCursor
                        || backCursor.i !== lastBackCursor,

                    scrollChanged = scroll.x !== lastScrollX
                        || scroll.y !== lastScrollY,

                    layoutChanged = resized
                        || boundsChanged
                        || textChanged
                        || characterWidthChanged
                        || characterHeightChanged
                        || paddingChanged
                        || scrollChanged
                        || themeChanged,

                    backgroundChanged = layoutChanged
                        || cursorChanged,

                    foregroundChanged = layoutChanged
                        || fontChanged,

                    trimChanged = layoutChanged
                        || focusChanged;

                if (backgroundChanged) {
                    renderCanvasBackground();
                }
                if (foregroundChanged) {
                    renderCanvasForeground();
                }
                if (trimChanged) {
                    renderCanvasTrim();
                }

                context.clearRect(0, 0, canv.width, canv.height);
                context.save();
                context.translate(vibX, vibY);
                context.drawImage(bg, 0, 0);
                context.drawImage(fg, 0, 0);
                context.drawImage(tg, 0, 0);
                context.restore();

                lastGridBounds = gridBounds.toString();
                lastText = value;
                lastCharacterWidth = character.width;
                lastCharacterHeight = character.height;
                lastPadding = padding;
                lastFrontCursor = frontCursor.i;
                lastBackCursor = backCursor.i;
                lastFocused = focused;
                lastFont = context.font;
                lastThemeName = theme.name;
                lastScrollX = scroll.x;
                lastScrollY = scroll.y;
                resized = false;
                queueMicrotask(() => {
                    this.dispatchEvent(updateEvt);
                })
            }
        };
        //<<<<<<<<<< RENDERING <<<<<<<<<<

        const refreshControlType = () => {
            const lastControlType = controlType;

            if (readOnly && multiLine) {
                controlType = multiLineOutput;
            }
            else if (readOnly && !multiLine) {
                controlType = singleLineOutput;
            }
            else if (!readOnly && multiLine) {
                controlType = multiLineInput;
            }
            else {
                controlType = singleLineInput;
            }

            if (controlType !== lastControlType) {
                refreshAllTokens();
            }
        };

        const refreshGutter = () => {
            if (!showScrollBars) {
                bottomRightGutter.set(0, 0);
            }
            else if (wordWrap) {
                bottomRightGutter.set(vScrollWidth, 0);
            }
            else {
                bottomRightGutter.set(vScrollWidth, 1);
            }
        };

        const setValue = (txt, setUndo) => {
            txt = txt || "";
            txt = txt.replace(/\r\n/g, "\n");
            if (txt !== value) {
                value = txt;
                if (setUndo) {
                    pushUndo();
                }
                refreshAllTokens();
                this.dispatchEvent(changeEvt);
            }
        };

        const setSelectedText = (txt) => {
            txt = txt || "";
            txt = txt.replace(/\r\n/g, "\n");

            if (frontCursor.i !== backCursor.i || txt.length > 0) {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor),
                    startRow = rows[minCursor.y],
                    endRow = rows[maxCursor.y],

                    unchangedLeft = value.substring(0, startRow.startStringIndex),
                    unchangedRight = value.substring(endRow.endStringIndex),

                    changedStartSubStringIndex = minCursor.i - startRow.startStringIndex,
                    changedLeft = startRow.substring(0, changedStartSubStringIndex),

                    changedEndSubStringIndex = maxCursor.i - endRow.startStringIndex,
                    changedRight = endRow.substring(changedEndSubStringIndex),

                    changedText = changedLeft + txt + changedRight;

                value = unchangedLeft + changedText + unchangedRight;
                pushUndo();

                refreshTokens(minCursor.y, maxCursor.y, changedText);
                frontCursor.setI(rows, minCursor.i + txt.length);
                backCursor.copy(frontCursor);
                scrollIntoView(frontCursor);
                this.dispatchEvent(changeEvt);
            }
        };

        const refreshAllTokens = () => {
            refreshTokens(0, rows.length - 1, value);
        }

        const refreshTokens = (startY, endY, txt) => {

            while (startY > 0
                && rows[startY].lineNumber === rows[startY - 1].lineNumber) {
                --startY;
                txt = rows[startY].text + txt;
            }

            while (endY < rows.length - 1 && rows[endY].lineNumber === rows[endY + 1].lineNumber) {
                ++endY;
                txt += rows[endY].text;
            }


            const newTokens = language.tokenize(txt),
                startRow = rows[startY],
                startTokenIndex = startRow.startTokenIndex,
                startLineNumber = startRow.lineNumber,
                startStringIndex = startRow.startStringIndex,
                endRow = rows[endY],
                endTokenIndex = endRow.endTokenIndex,
                tokenRemoveCount = endTokenIndex - startTokenIndex,
                oldTokens = tokens.splice(startTokenIndex, tokenRemoveCount, ...newTokens);

            // figure out the width of the line count gutter
            lineCountWidth = 0;
            if (showLineNumbers) {
                for (let token of oldTokens) {
                    if (token.type === "newlines") {
                        --lineCount;
                    }
                }

                for (let token of newTokens) {
                    if (token.type === "newlines") {
                        ++lineCount;
                    }
                }

                lineCountWidth = Math.max(1, Math.ceil(Math.log(lineCount) / Math.LN10)) + 1;
            }

            // measure the grid
            // const x = Math.floor(lineCountWidth + padding / character.width),
            //     y = Math.floor(padding / character.height),
            //     w = Math.floor((this.width - 2 * padding) / character.width) - x - bottomRightGutter.width,
            //     h = Math.floor((this.height - 2 * padding) / character.height) - y - bottomRightGutter.height;
            const x = 0,//Math.floor(lineCountWidth + padding / character.width),
                y = 0,//Math.floor(padding / character.height),
                w = Math.ceil(this.width / character.width) - x, //- bottomRightGutter.width,
                h = Math.ceil(this.height / character.height) - y //- bottomRightGutter.height;
            gridBounds.set(x, y, w, h);
            // Perform the layout
            const tokenQueue = newTokens.map(t => t.clone()),
                rowRemoveCount = endY - startY + 1,
                newRows = [];

            let currentString = "",
                currentTokens = [],
                currentStringIndex = startStringIndex,
                currentTokenIndex = startTokenIndex,
                currentLineNumber = startLineNumber;

            for (let i = 0; i < tokenQueue.length; ++i) {
                const t = tokenQueue[i],
                    widthLeft = gridBounds.width - currentString.length,
                    wrap = wordWrap && t.type !== "newlines" && t.length > widthLeft,
                    breakLine = t.type === "newlines" || wrap;

                if (wrap) {
                    const split = t.length > gridBounds.width
                        ? widthLeft
                        : 0;
                    tokenQueue.splice(i + 1, 0, t.splitAt(split));
                }

                currentTokens.push(t);
                currentString += t.value;

                if (breakLine
                    || i === tokenQueue.length - 1) {
                    newRows.push(new Row(currentString, currentTokens, currentStringIndex, currentTokenIndex, currentLineNumber));
                    currentStringIndex += currentString.length;
                    currentTokenIndex += currentTokens.length;

                    currentTokens = [];
                    currentString = "";

                    if (t.type === "newlines") {
                        ++currentLineNumber;
                    }
                }
            }

            rows.splice(startY, rowRemoveCount, ...newRows);

            // renumber rows
            for (let y = startY + newRows.length; y < rows.length; ++y) {
                const row = rows[y];
                row.lineNumber = currentLineNumber;
                row.startStringIndex = currentStringIndex;
                row.startTokenIndex += currentTokenIndex;

                currentStringIndex += row.stringLength;
                currentTokenIndex += row.numTokens;

                if (row.tokens[row.tokens.length - 1]?.type === "newlines") {
                    ++currentLineNumber;
                }
            }

            // provide editing room at the end of the buffer
            if (rows.length === 0) {
                rows.push(Row.emptyRow(0, 0, 0));
            }
            else {
                const lastRow = rows[rows.length - 1];
                if (lastRow.text.endsWith('\n')) {
                    rows.push(Row.emptyRow(lastRow.endStringIndex, lastRow.endTokenIndex, lastRow.lineNumber + 1));
                }
            }

            maxVerticalScroll = Math.max(0, rows.length-2-(+(rows[rows.length-1].text.trim() === ''))); // - gridBounds.height);

            render();
        };

        const refreshBuffers = () => {
            resized = true;
            setContextSize(fgfx, canv.width, canv.height);
            setContextSize(bgfx, canv.width, canv.height);
            setContextSize(tgfx, canv.width, canv.height);
            refreshAllTokens();
        };

        const minDelta = (v, minV, maxV) => {
            const dvMinV = v - minV,
                dvMaxV = v - maxV + 2;
            let dv = 0;
            if (dvMinV < 0 || dvMaxV >= 0) {
                // compare the absolute values, so we get the smallest change
                // regardless of direction.
                dv = Math.abs(dvMinV) < Math.abs(dvMaxV)
                    ? dvMinV
                    : dvMaxV;
            }

            return dv;
        };

        const clampScroll = () => {
            const toHigh = scroll.y < 0 || maxVerticalScroll === 0,
                toLow = scroll.y > maxVerticalScroll + 1;

            if (toHigh) {
                scroll.y = 0;
            }
            else if (toLow) {
                scroll.y = maxVerticalScroll + 1;
            }
            render();

            return toHigh || toLow;
        };

        const scrollIntoView = (currentCursor) => {
            const dx = minDelta(currentCursor.x, scroll.x, scroll.x + gridBounds.width),
                dy = minDelta(currentCursor.y, scroll.y, scroll.y + gridBounds.height);
            this.scrollBy(dx, dy);
        };

        const pushUndo = () => {
            if (historyIndex < history.length - 1) {
                history.splice(historyIndex + 1);
            }
            history.push({
                value,
                frontCursor: frontCursor.i,
                backCursor: backCursor.i
            });
            historyIndex = history.length - 1;
        };

        const moveInHistory = (dh) => {
            const nextHistoryIndex = historyIndex + dh;
            if (0 <= nextHistoryIndex && nextHistoryIndex < history.length) {
                const curFrame = history[historyIndex];
                historyIndex = nextHistoryIndex;
                const nextFrame = history[historyIndex];
                setValue(nextFrame.value, false);
                frontCursor.setI(rows, curFrame.frontCursor);
                backCursor.setI(rows, curFrame.backCursor);
            }
        }
        //<<<<<<<<<< PRIVATE METHODS <<<<<<<<<<


        //>>>>>>>>>> PUBLIC METHODS >>>>>>>>>>

        /// <summary>
        /// Removes focus from the control.
        /// </summary>
        this.blur = () => {
            if (focused) {
                focused = false;
                focusedControl = null;
                this.dispatchEvent(blurEvt);
                // render();
                refreshBuffers();
            }
        };

        /// <summary>
        /// Sets the control to be the focused control. If all controls in the app have been properly registered with the Event Manager, then any other, currently focused control will first get `blur`red.
        /// </summary>
        this.focus = () => {
            if (!focused) {
                focused = true;
                this.dispatchEvent(focusEvt);
                // render();
                refreshBuffers();
            }
        };

        /// <summary>
        /// </summary>
        this.resize = () => {
            if (!this.isInDocument) {
                console.warn("Can't automatically resize a canvas that is not in the DOM tree");
            }
            else if (resizeContext(context, scaleFactor)) {
                refreshBuffers();
            }
        };

        /// <summary>
        /// Sets the scale-independent width and height of the editor control.
        /// </summary>
        this.setSize = (w, h) => {
            if (setContextSize(context, w, h, scaleFactor)) {
                refreshBuffers();
            }
        };

        /// <summary>
        /// Move the scroll window to a new location. Values get clamped to the text contents of the editor.
        /// </summary>
        this.scrollTo = (x, y) => {
            if (!wordWrap) {
                scroll.x = x;
            }
            scroll.y = y;
            return clampScroll();
        };

        /// <summary>
        /// Move the scroll window by a given amount to a new location. The final location of the scroll window gets clamped to the text contents of the editor.
        /// </summary>
        this.scrollBy = (dx, dy) => {
            return this.scrollTo(scroll.x + dx, scroll.y + dy);
        };
        //<<<<<<<<<< PUBLIC METHODS <<<<<<<<<<


        //>>>>>>>>>> KEY EVENT HANDLERS >>>>>>>>>>
        const keyDownCommands = Object.freeze(new Map([
            ["CursorUp", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                minCursor.up(rows);
                maxCursor.copy(minCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorDown", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                maxCursor.down(rows);
                minCursor.copy(maxCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorLeft", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                if (minCursor.i === maxCursor.i) {
                    minCursor.left(rows);
                }
                maxCursor.copy(minCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorRight", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                if (minCursor.i === maxCursor.i) {
                    maxCursor.right(rows);
                }
                minCursor.copy(maxCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorPageUp", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                minCursor.incY(rows, -gridBounds.height);
                maxCursor.copy(minCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorPageDown", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                maxCursor.incY(rows, gridBounds.height);
                minCursor.copy(maxCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorSkipLeft", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                if (minCursor.i === maxCursor.i) {
                    minCursor.skipLeft(rows);
                }
                maxCursor.copy(minCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorSkipRight", () => {
                const minCursor = Cursor.min(frontCursor, backCursor),
                    maxCursor = Cursor.max(frontCursor, backCursor);
                if (minCursor.i === maxCursor.i) {
                    maxCursor.skipRight(rows);
                }
                minCursor.copy(maxCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorHome", () => {
                frontCursor.home();
                backCursor.copy(frontCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorEnd", () => {
                frontCursor.end(rows);
                backCursor.copy(frontCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorFullHome", () => {
                frontCursor.fullHome(rows);
                backCursor.copy(frontCursor);
                scrollIntoView(frontCursor);
            }],

            ["CursorFullEnd", () => {
                frontCursor.fullEnd(rows);
                backCursor.copy(frontCursor);
                scrollIntoView(frontCursor);
            }],

            ["SelectDown", () => {
                backCursor.down(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectLeft", () => {
                backCursor.left(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectRight", () => {
                backCursor.right(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectUp", () => {
                backCursor.up(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectPageDown", () => {
                backCursor.incY(rows, gridBounds.height);
                scrollIntoView(backCursor);
            }],

            ["SelectPageUp", () => {
                backCursor.incY(rows, -gridBounds.height);
                scrollIntoView(backCursor);
            }],

            ["SelectSkipLeft", () => {
                backCursor.skipLeft(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectSkipRight", () => {
                backCursor.skipRight(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectHome", () => {
                backCursor.home();
                scrollIntoView(backCursor);
            }],

            ["SelectEnd", () => {
                backCursor.end(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectFullHome", () => {
                backCursor.fullHome(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectFullEnd", () => {
                backCursor.fullEnd(rows);
                scrollIntoView(backCursor);
            }],

            ["SelectAll", () => {
                frontCursor.fullHome();
                backCursor.fullEnd(rows);
                render();
            }],

            ["ScrollDown", () => {
                if (scroll.y < rows.length - gridBounds.height) {
                    this.scrollBy(0, 1);
                }
            }],

            ["ScrollUp", () => {
                if (scroll.y > 0) {
                    this.scrollBy(0, -1);
                }
            }],

            ["DeleteLetterLeft", () => {
                if (frontCursor.i === backCursor.i) {
                    backCursor.left(rows);
                }
                setSelectedText("");
            }],

            ["DeleteLetterRight", () => {
                if (frontCursor.i === backCursor.i) {
                    backCursor.right(rows);
                }
                setSelectedText("");
            }],

            ["DeleteWordLeft", () => {
                if (frontCursor.i === backCursor.i) {
                    frontCursor.skipLeft(rows);
                }
                setSelectedText("");
            }],

            ["DeleteWordRight", () => {
                if (frontCursor.i === backCursor.i) {
                    backCursor.skipRight(rows);
                }
                setSelectedText("");
            }],

            ["DeleteLine", () => {
                if (frontCursor.i === backCursor.i) {
                    frontCursor.home();
                    backCursor.end(rows);
                    backCursor.right(rows);
                }
                setSelectedText("");
            }],

            ["Undo", () => {
                moveInHistory(-1);
            }],

            ["Redo", () => {
                moveInHistory(1);
            }],

            ["InsertTab", () => {
                tabPressed = true;
                setSelectedText(tabString);
            }],

            ["RemoveTab", () => {
                const row = rows[frontCursor.y],
                    toDelete = Math.min(frontCursor.x, tabWidth);
                for (let i = 0; i < frontCursor.x; ++i) {
                    if (row.text[i] !== ' ') {
                        // can only remove tabs at the beginning of a row
                        return;
                    }
                }

                backCursor.copy(frontCursor);
                backCursor.incX(rows, -toDelete);
                setSelectedText("");
            }]
        ]));

        this.readKeyDownEvent = debugEvt("keydown", (evt) => {
            const command = os.makeCommand(evt);
            if (keyDownCommands.has(command.command)) {
                evt.preventDefault();
                keyDownCommands.get(command.command)(evt);
            }
        });


        const keyPressCommands = Object.freeze(new Map([
            ["AppendNewline", () => {
                if (multiLine) {
                    let indent = "";
                    const row = rows[frontCursor.y].tokens;
                    if (row.length > 0
                        && row[0].type === "whitespace") {
                        indent = row[0].value;
                    }
                    setSelectedText("\n" + indent);
                }
                else {
                    this.dispatchEvent(changeEvt);
                }
            }],

            ["PrependNewline", () => {
                if (multiLine) {
                    let indent = "";
                    const row = rows[frontCursor.y].tokens;
                    if (row.length > 0
                        && row[0].type === "whitespace") {
                        indent = row[0].value;
                    }
                    frontCursor.home();
                    backCursor.copy(frontCursor);
                    setSelectedText(indent + "\n");
                }
                else {
                    this.dispatchEvent(changeEvt);
                }
            }],

            ["Undo", () => {
                moveInHistory(-1);
            }]
        ]));

        this.readKeyPressEvent = debugEvt("keypress", (evt) => {
            const command = os.makeCommand(evt);
            if (!this.readOnly) {
                evt.preventDefault();

                if (keyPressCommands.has(command.command)) {
                    keyPressCommands.get(command.command)();
                }
                else if (command.type === "printable"
                    || command.type === "whitespace") {
                    setSelectedText(command.text);
                }

                clampScroll();
                render();
            }
        });

        this.readKeyUpEvent = debugEvt("keyup");
        //<<<<<<<<<< KEY EVENT HANDLERS <<<<<<<<<<


        //>>>>>>>>>> CLIPBOARD EVENT HANDLERS >>>>>>>>>>
        const copySelectedText = (evt) => {
            if (focused && frontCursor.i !== backCursor.i) {
                evt.clipboardData.setData("text/plain", this.selectedText);
                evt.returnValue = false;
                return true;
            }

            return false;
        };

        this.readCopyEvent = debugEvt("copy", (evt) => {
            copySelectedText(evt);
        });

        this.readCutEvent = debugEvt("cut", (evt) => {
            if (copySelectedText(evt)
                && !this.readOnly) {
                setSelectedText("");
            }
        });

        this.readPasteEvent = debugEvt("paste", (evt) => {
            if (focused && !this.readOnly) {
                evt.returnValue = false;
                const clipboard = evt.clipboardData || window.clipboardData,
                    str = clipboard.getData(window.clipboardData ? "Text" : "text/plain");
                if (str) {
                    setSelectedText(str);
                }
            }
        });
        //<<<<<<<<<< CLIPBOARD EVENT HANDLERS <<<<<<<<<<


        //>>>>>>>>>> POINTER EVENT HANDLERS >>>>>>>>>>
        const pointerOver = () => {
            hovered = true;
            this.dispatchEvent(overEvt);
        };

        const pointerOut = () => {
            hovered = false;
            this.dispatchEvent(outEvt);
        };

        const pointerDown = () => {
            this.focus();
            pressed = true;
        };

        const startSelecting = () => {
            dragging = true;
            moveCursor(frontCursor);
        };

        const pointerMove = () => {
            if (dragging) {
                moveCursor(backCursor);
            }
            else if (pressed) {
                dragScroll();
            }
        };

        const moveCursor = (cursor) => {
            pointer.toCell(character, scroll, gridBounds);
            const gx = pointer.x - scroll.x,
                gy = pointer.y - scroll.y,
                onBottom = gy >= gridBounds.height,
                onLeft = gx < 0,
                onRight = pointer.x >= gridBounds.width;

            if (!scrolling && !onBottom && !onLeft && !onRight) {
                cursor.setXY(rows, pointer.x, pointer.y);
                backCursor.copy(cursor);
            }
            else if (scrolling || onRight && !onBottom) {
                scrolling = true;
                const scrollHeight = rows.length - gridBounds.height;
                if (gy >= 0 && scrollHeight >= 0) {
                    const sy = gy * scrollHeight / gridBounds.height;
                    this.scrollTo(scroll.x, sy);
                }
            }
            else if (onBottom && !onLeft) {
                let maxWidth = 0;
                for (let dy = 0; dy < rows.length; ++dy) {
                    maxWidth = Math.max(maxWidth, rows[dy].stringLength);
                }
                const scrollWidth = maxWidth - gridBounds.width;
                if (gx >= 0 && scrollWidth >= 0) {
                    const sx = gx * scrollWidth / gridBounds.width;
                    this.scrollTo(sx, scroll.y);
                }
            }
            else if (onLeft && !onBottom) {
                // clicked in number-line gutter
            }
            else {
                // clicked in the lower-left corner
            }

            render();
        }

        let lastScrollDX = null,
            lastScrollDY = null;
        const dragScroll = () => {
            if (lastScrollDX !== null
                && lastScrollDY !== null) {
                let dx = (lastScrollDX - pointer.x) / character.width,
                    dy = (lastScrollDY - pointer.y) / character.height;
                this.scrollBy(dx, dy);
            }
            lastScrollDX = pointer.x;
            lastScrollDY = pointer.y;
        };

        const mouseLikePointerDown = (setPointer) => {
            return (evt) => {
                setPointer(evt);
                pointerDown();
                startSelecting();
            }
        };

        const mouseLikePointerUp = () => {
            pressed = false;
            dragging = false;
            scrolling = false;
        };

        const mouseLikePointerMove = (setPointer) => {
            return (evt) => {
                setPointer(evt);
                pointerMove();
            };
        };

        const touchLikePointerDown = (setPointer) => {
            return (evt) => {
                setPointer(evt);
                tx = pointer.x;
                ty = pointer.y;
                pointerDown();
                longPress.start();
            };
        };

        const touchLikePointerUp = () => {
            if (longPress.cancel() && !dragging) {
                startSelecting();
            }
            mouseLikePointerUp();
            lastScrollDX = null;
            lastScrollDY = null;
        };

        const touchLikePointerMove = (setPointer) => {
            return (evt) => {
                setPointer(evt);
                if (longPress.isRunning) {
                    const dx = pointer.x - tx,
                        dy = pointer.y - ty,
                        lenSq = dx * dx + dy * dy;
                    if (lenSq > 25) {
                        longPress.cancel();
                    }
                }

                if (!longPress.isRunning) {
                    pointerMove();
                }
            };
        };


        //>>>>>>>>>> MOUSE EVENT HANDLERS >>>>>>>>>>
        const setMousePointer = (evt) => {
            pointer.set(
                evt.realOffsetX ?? evt.offsetX,
                evt.realOffsetY ?? evt.offsetY);
        };
        this.readMouseOverEvent = debugEvt("mouseover", pointerOver);
        this.readMouseOutEvent = debugEvt("mouseout", pointerOut);
        this.readMouseDownEvent = debugEvt("mousedown", mouseLikePointerDown(setMousePointer));
        this.readMouseUpEvent = debugEvt("mouseup", mouseLikePointerUp);
        this.readMouseMoveEvent = debugEvt("mousemove", mouseLikePointerMove(setMousePointer));

        this.readWheelEvent = debugEvt("wheel", (evt) => {
            if (hovered || focused) {
                if (!evt.ctrlKey
                    && !evt.altKey
                    && !evt.shiftKey
                    && !evt.metaKey) {
                    const dy = Math.floor(evt.deltaY * wheelScrollSpeed / scrollScale);
                    if (!this.scrollBy(0, dy) || focused) {
                        evt.preventDefault();
                    }
                }
                else if (!evt.ctrlKey
                    && !evt.altKey
                    && !evt.metaKey) {
                    evt.preventDefault();
                    this.fontSize += -evt.deltaY / scrollScale;
                }
                render();
            }
        });
        //<<<<<<<<<< MOUSE EVENT HANDLERS <<<<<<<<<<


        //>>>>>>>>>> TOUCH EVENT HANDLERS >>>>>>>>>>
        let vibX = 0,
            vibY = 0;

        const vibrate = (len) => {
            longPress.cancel();
            if (len > 0) {
                vibX = (Math.random() - 0.5) * 10;
                vibY = (Math.random() - 0.5) * 10;
                setTimeout(() => vibrate(len - 10), 10);
            }
            else {
                vibX = 0;
                vibY = 0;
            }
            render();
        };

        const longPress = new TimedEvent(1000);

        longPress.addEventListener("tick", () => {
            startSelecting();
            backCursor.copy(frontCursor);
            frontCursor.skipLeft(rows);
            backCursor.skipRight(rows);
            render();
            navigator.vibrate(20);
            if (isDebug) {
                vibrate(320);
            }
        });

        let tx = 0,
            ty = 0,
            currentTouchID = null;

        const findTouch = (touches) => {
            for (let touch of touches) {
                if (currentTouchID === null
                    || touch.identifier === currentTouchID) {
                    return touch;
                }
            }
            return null;
        }

        const withPrimaryTouch = (callback) => {
            return (evt) => {
                evt.preventDefault();
                callback(findTouch(evt.touches)
                    || findTouch(evt.changedTouches))
            };
        };

        const setTouchPointer = (touch) => {
            const cb = canv.getBoundingClientRect();
            pointer.set(
                touch.clientX - cb.left,
                touch.clientY - cb.top);
        };

        this.readTouchStartEvent = debugEvt("touchstart", withPrimaryTouch(touchLikePointerDown(setTouchPointer)));
        this.readTouchMoveEvent = debugEvt("touchmove", withPrimaryTouch(touchLikePointerMove(setTouchPointer)));
        this.readTouchEndEvent = debugEvt("touchend", withPrimaryTouch(touchLikePointerUp));
        //<<<<<<<<<< TOUCH EVENT HANDLERS <<<<<<<<<<


        //>>>>>>>>>> UV POINTER EVENT HANDLERS >>>>>>>>>>
        const setUVPointer = (evt) => {
            pointer.set(
                evt.uv.x * this.width,
                (1 - evt.uv.y) * this.height);
        }

        this.mouse = Object.freeze({

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform the hover gestures.
            // </summary>
            readOverEventUV: debugEvt("mouseuvover", pointerOver),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform the end of the hover gesture.
            // </summary>
            readOutEventUV: debugEvt("mouseuvout", pointerOut),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform mouse-like behavior for primary-button-down gesture.
            // </summary>
            readDownEventUV: debugEvt("mouseuvdown", mouseLikePointerDown(setUVPointer)),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform mouse-like behavior for primary-button-up gesture.
            // </summary>
            readUpEventUV: debugEvt("mouseuvup", mouseLikePointerUp),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform mouse-like behavior for move gesture, whether the primary button is pressed or not.
            // </summary>
            readMoveEventUV: debugEvt("mouseuvmove", mouseLikePointerMove(setUVPointer))
        });

        this.touch = Object.freeze({

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform the end of the hover gesture. This is the same as mouse.readOverEventUV, included for completeness.
            // </summary>
            readOverEventUV: debugEvt("touchuvover", pointerOver),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform the end of the hover gesture. This is the same as mouse.readOutEventUV, included for completeness.
            // </summary>
            readOutEventUV: debugEvt("touchuvout", pointerOut),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform touch-like behavior for the first finger touching down gesture.
            // </summary>
            readDownEventUV: debugEvt("touchuvdown", touchLikePointerDown(setUVPointer)),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform touch-like behavior for the first finger raising up gesture.
            // </summary>
            readMoveEventUV: debugEvt("touchuvmove", touchLikePointerMove(setUVPointer)),

            /// <summary>
            /// Read's a THREE.js Raycast intersection to perform touch-like behavior for the first finger moving gesture.
            // </summary>
            readUpEventUV: debugEvt("touchuvup", touchLikePointerUp)
        });
        //<<<<<<<<<< UV POINTER EVENT HANDLERS <<<<<<<<<<
        //<<<<<<<<<< POINTER EVENT HANDLERS <<<<<<<<<<


        //>>>>>>>>>> PUBLIC PROPERTIES >>>>>>>>>>
        Object.defineProperties(this, {

            /// <summary>
            /// The DOM element that was used to construct the `Primrose` control out of the document tree.If the Control was not constructed from the document tree, this value will be`null`.
            /// </summary>
            element: {
                get: () => element
            },

            /// <summary>
            /// Returns `false` if `element` is null. Returns `true` otherwise.
            /// </summary>
            isInDocument: {
                get: () => !isOffScreen
                    && document.body.contains(canv)
            },

            /// <summary>
            /// The canvas to which the editor is rendering text. If the `options.element` value was set to a canvas, that canvas will be returned. Otherwise, the canvas will be the canvas that Primrose created for the control. If `OffscreenCanvas` is not available, the canvas will be an `HTMLCanvasElement`.
            /// </summary>
            canvas: {
                get: () => canv
            },

            /// <summary>
            /// Returns `true` when the control has a pointer hovering over it.
            /// </summary>
            hovered: {
                get: () => hovered
            },

            /// <summary>
            /// Returns `true` when the control has been selected.Writing to this value will change the focus state of the control.
            /// If the control is already focused and`focused` is set to`true`, or the control is not focused and`focus` is set to`false`, nothing happens.
            /// If the control is focused and`focused` is set to`false`, the control is blurred, just as if `blur()` was called.
            /// If the control is not focused and`focused` is set to`true`, the control is blurred, just as if `focus()` was called.
            /// </summary>
            focused: {
                get: () => focused,
                set: (f) => {
                    if (f !== focused) {
                        if (f) {
                            this.focus();
                        }
                        else {
                            this.blur();
                        }
                    }
                }
            },

            /// <summary>
            /// Indicates whether or not the text in the editor control can be modified.
            /// </summary>
            readOnly: {
                get: () => readOnly,
                set: (r) => {
                    r = !!r;
                    if (r !== readOnly) {
                        readOnly = r;
                        refreshControlType();
                    }
                }
            },

            multiLine: {
                get: () => multiLine,
                set: (m) => {
                    m = !!m;
                    if (m !== multiLine) {
                        if (!m && wordWrap) {
                            this.wordWrap = false;
                        }
                        multiLine = m;
                        refreshControlType();
                        refreshGutter();
                    }
                }
            },

            /// <summary>
            /// Indicates whether or not the text in the editor control will be broken across lines when it reaches the right edge of the editor control.
            /// </summary>
            wordWrap: {
                get: () => wordWrap,
                set: (w) => {
                    w = !!w;
                    if (w !== wordWrap
                        && (multiLine
                            || !w)) {
                        wordWrap = w;
                        refreshGutter();
                        render();
                    }
                }
            },

            /// <summary>
            /// The text value contained in the control. NOTE: if the text value was set with Windows-style newline characters (`\r\n`), the newline characters will be normalized to Unix-style newline characters (`\n`).
            /// </summary>
            value: {
                get: () => value,
                set: (txt) => setValue(txt, true)
            },

            /// <summary>
            /// A synonymn for `value`
            /// </summary>
            text: {
                get: () => value,
                set: (txt) => setValue(txt, true)
            },

            /// <summary>
            /// The range of text that is currently selected by the cursor. If no text is selected, reading `selectedText` returns the empty string (`""`) and writing to it inserts text at the current cursor location.
            /// If text is selected, reading `selectedText` returns the text between the front and back cursors, writing to it overwrites the selected text, inserting the provided value.
            /// </summary>
            selectedText: {
                get: () => {
                    const minCursor = Cursor.min(frontCursor, backCursor),
                        maxCursor = Cursor.max(frontCursor, backCursor);
                    return value.substring(minCursor.i, maxCursor.i);
                },
                set: (txt) => {
                    setSelectedText(txt);
                }
            },

            /// <summary>
            /// The string index at which the front cursor is located. NOTE: the "front cursor" is the main cursor, but does not necessarily represent the beginning of the selction range. The selection range runs from the minimum of front and back cursors, to the maximum.
            /// </summary>
            selectionStart: {
                get: () => frontCursor.i,
                set: (i) => {
                    i = i | 0;
                    if (i !== frontCursor.i) {
                        frontCursor.setI(rows, i);
                        render();
                    }
                }
            },

            /// <summary>
            /// The string index at which the back cursor is located. NOTE: the "back cursor" is the selection range cursor, but does not necessarily represent the end of the selction range. The selection range runs from the minimum of front and back cursors, to the maximum.
            /// </summary>
            selectionEnd: {
                get: () => backCursor.i,
                set: (i) => {
                    i = i | 0;
                    if (i !== backCursor.i) {
                        backCursor.setI(rows, i);
                        render();
                    }
                }
            },

            /// <summary>
            /// If the back cursor is behind the front cursor, this value returns `"backward"`. Otherwise, `"forward"` is returned.
            /// </summary>
            selectionDirection: {
                get: () => frontCursor.i <= backCursor.i
                    ? "forward"
                    : "backward"
            },

            /// <summary>
            /// The number of spaces to insert when the <kbd>Tab</kbd> key is pressed. Changing this value does not convert existing tabs, it only changes future tabs that get inserted.
            /// </summary>
            tabWidth: {
                get: () => tabWidth,
                set: (tw) => {
                    tabWidth = tw || 2;
                    tabString = "";
                    for (let i = 0; i < tabWidth; ++i) {
                        tabString += " ";
                    }
                }
            },

            /// <summary>
            /// A JavaScript object that defines the color and style values for rendering different UI and text elements.
            /// </summary>
            theme: {
                get: () => theme,
                set: (t) => {
                    if (t !== theme) {
                        theme = t;
                        render();
                    }
                }
            },

            /// <summary>
            /// Set or get the language pack used to tokenize the control text for syntax highlighting.
            /// </summary>
            language: {
                get: () => language,
                set: (l) => {
                    if (l !== language) {
                        language = l;
                        refreshAllTokens();
                    }
                }
            },

            /// <summary>
            /// The `Number` of pixels to inset the control rendering from the edge of the canvas. This is useful for texturing objects where the texture edge cannot be precisely controlled. This value is scale-independent.
            /// </summary>
            padding: {
                get: () => padding,
                set: (p) => {
                    p = p | 0;
                    if (p !== padding) {
                        padding = p;
                        render();
                    }
                }
            },

            /// <summary>
            /// Indicates whether or not line numbers should be rendered on the left side of the control.
            /// </summary>
            showLineNumbers: {
                get: () => showLineNumbers,
                set: (s) => {
                    s = s || false;
                    if (s !== showLineNumbers) {
                        showLineNumbers = s;
                        refreshGutter();
                    }
                }
            },

            /// <summary>
            /// Indicates whether or not scroll bars should be rendered at the right and bottom in the control. If wordWrap is enabled, the bottom, horizontal scrollbar will not be rendered.
            /// </summary>
            showScrollBars: {
                get: () => showScrollBars,
                set: (s) => {
                    s = s || false;
                    if (s !== showScrollBars) {
                        showScrollBars = s;
                        refreshGutter();
                    }
                }
            },

            /// <summary>
            /// The `Number` of pixels tall to draw characters. This value is scale-independent.
            /// </summary>
            fontSize: {
                get: () => fontSize,
                set: (s) => {
                    s = Math.max(1, s || 0);
                    if (s !== fontSize) {
                        fontSize = s;
                        context.font = `${fontSize}px ${monospaceFamily}`;
                        character.height = fontSize - 2;
                        // measure 100 letter M's, then divide by 100, to get the width of an M
                        // to two decimal places on systems that return integer values from
                        // measureText.
                        character.width = context.measureText(
                            "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM")
                            .width /
                            100;
                        refreshAllTokens();
                    }
                }
            },

            /// <summary>
            /// The value by which pixel values are scaled before being used by the editor control.
            /// With THREE.js, it's best to set this value to 1 and change the width, height, and fontSize manually.
            /// </summary>
            scaleFactor: {
                get: () => scaleFactor,
                set: (s) => {
                    s = Math.max(0.25, Math.min(4, s || 0));
                    if (s !== scaleFactor) {
                        const lastWidth = this.width,
                            lastHeight = this.height
                        scaleFactor = s;
                        this.setSize(lastWidth, lastHeight);
                    }
                }
            },

            /// <summary>
            /// The scale-independent width of the editor control.
            /// </summary>
            width: {
                get: () => canv.width / scaleFactor,
                set: (w) => this.setSize(w, this.height)
            },

            /// <summary>
            /// The scale-independent height of the editor control.
            /// </summary>
            height: {
                get: () => canv.height / scaleFactor,
                set: (h) => this.setSize(this.width, h)
            }
        });
        //<<<<<<<<<< PUBLIC PROPERTIES <<<<<<<<<<


        //>>>>>>>>>> PRIVATE MUTABLE FIELDS >>>>>>>>>>
        let value = "",
            padding = 0,
            theme = DefaultTheme,
            tabWidth = 2,
            canv = null,
            resized = false,
            hovered = false,
            focused = false,
            fontSize = null,
            scaleFactor = 2,
            pressed = false,
            tabString = "  ",
            readOnly = false,
            dragging = false,
            wordWrap = false,
            historyIndex = -1,
            scrolling = false,
            multiLine = false,
            tabPressed = false,
            lineCount = 1,
            lineCountWidth = 0,
            isOffScreen = false,
            element = null,
            language = JavaScript,
            showScrollBars = false,
            showLineNumbers = false,
            elementID = ++elementCounter,
            controlType = singleLineOutput,
            maxVerticalScroll = 0,

            lastCharacterHeight = null,
            lastCharacterWidth = null,
            lastFrontCursor = null,
            lastGridBounds = null,
            lastBackCursor = null,
            lastThemeName = null,
            lastPadding = null,
            lastFocused = null,
            lastScrollX = null,
            lastScrollY = null,
            lastFont = null,
            lastText = null;

        const history = [],
            tokens = [],
            rows = [Row.emptyRow(0, 0, 0)],
            scroll = new Point(),
            pointer = new Point(),
            character = new Size(),
            bottomRightGutter = new Size(),
            gridBounds = new Rectangle(),
            tokenBack = new Cursor(),
            tokenFront = new Cursor(),
            backCursor = new Cursor(),
            frontCursor = new Cursor(),
            outEvt = new Event("out"),
            overEvt = new Event("over"),
            blurEvt = new Event("blur"),
            focusEvt = new Event("focus"),
            changeEvt = new Event("change"),
            updateEvt = new Event("update"),
            os = isApple ? MacOS : Windows;
        //<<<<<<<<<< PRIVATE MUTABLE FIELDS <<<<<<<<<<

        //>>>>>>>>>> SETUP CANVAS >>>>>>>>>>
        let currentValue = "",
            currentTabIndex = -1;

        if (options.element !== null) {
            const elem = options.element,
                width = elem.width,
                height = elem.height;
            currentTabIndex = elem.tabIndex;

            const optionsStr = elem.dataset.options || "",
                entries = optionsStr.trim().split(','),
                optionUser = {};
            for (let entry of entries) {
                entry = entry.trim();
                if (entry.length > 0) {
                    const pairs = entry.split('=');
                    if (pairs.length > 1) {
                        const key = pairs[0].trim(),
                            value = pairs[1].trim(),
                            boolTest = value.toLocaleLowerCase();
                        if (boolTest === "true"
                            || boolTest === "false") {
                            optionUser[key] = boolTest === "true";
                        }
                        else {
                            optionUser[key] = value;
                        }
                    }
                }
            }

            currentValue = elem.textContent;
            options = Object.assign(
                options,
                { width, height },
                optionUser);
        }


        if (options.element === null) {
            canv = offscreenCanvas(options);
            isOffScreen = !(canv instanceof HTMLCanvasElement);
        }
        else if (isCanvas(options.element)) {
            element = canv = options.element;
            clear(canv);
        }
        else {
            element = options.element;
            clear(element);

            canv = canvas({
                style: {
                    width: "100%",
                    height: "100%"
                }
            });
            element.appendChild(canv);
            element.removeAttribute("tabindex");

            assignAttributes(element, {
                style: {
                    display: "block",
                    padding: "none",
                    border: "2px inset #c0c0c0",
                    overflow: "unset"
                }
            });
        }

        if (canv.parentElement !== null
            && currentTabIndex === -1) {
            const tabbableElements = document.querySelectorAll("[tabindex]");
            for (let tabbableElement of tabbableElements) {
                currentTabIndex = Math.max(currentTabIndex, tabbableElement.tabIndex);
            }
            ++currentTabIndex;
        }

        if (canv instanceof HTMLCanvasElement
            && this.isInDocument) {
            canv.tabIndex = currentTabIndex;
            canv.style.touchAction = "none";
            canv.addEventListener("focus", () => this.focus());
            canv.addEventListener("blur", () => this.blur());

            canv.addEventListener("mouseover", this.readMouseOverEvent);
            canv.addEventListener("mouseout", this.readMouseOutEvent);
            canv.addEventListener("mousedown", this.readMouseDownEvent);
            canv.addEventListener("mouseup", this.readMouseUpEvent);
            canv.addEventListener("mousemove", this.readMouseMoveEvent);

            canv.addEventListener("touchstart", this.readTouchStartEvent);
            canv.addEventListener("touchend", this.readTouchEndEvent);
            canv.addEventListener("touchmove", this.readTouchMoveEvent);
        }
        //<<<<<<<<<< SETUP CANVAS <<<<<<<<<<

        //>>>>>>>>>> SETUP BUFFERS >>>>>>>>>>
        const context = canv.getContext("2d"),
            fg = offscreenCanvas(),
            fgfx = fg.getContext("2d"),
            bg = offscreenCanvas(),
            bgfx = bg.getContext("2d"),
            tg = offscreenCanvas(),
            tgfx = tg.getContext("2d");

        context.imageSmoothingEnabled
            = fgfx.imageSmoothingEnabled
            = bgfx.imageSmoothingEnabled
            = tgfx.imageSmoothingEnabled
            = false;
        context.textBaseline
            = fgfx.textBaseline
            = bgfx.textBaseline
            = tgfx.textBaseline
            = "top";

        tgfx.textAlign = "right";
        fgfx.textAlign = "left";
        //<<<<<<<<<< SETUP BUFFERS <<<<<<<<<<

        //>>>>>>>>>> INITIALIZE STATE >>>>>>>>>>
        this.addEventListener("blur", () => {
            if (tabPressed) {
                tabPressed = false;
                this.focus();
            }
        });

        options.language = options.language.toLocaleLowerCase();
        if (grammars.has(options.language)) {
            options.language = grammars.get(options.language);
        }
        else {
            options.language = null;
        }
        Object.freeze(options);

        // Object.seal(this);
        this.readOnly = options.readOnly;
        this.multiLine = options.multiLine;
        this.wordWrap = options.wordWrap;
        this.showScrollBars = options.scrollBars;
        this.showLineNumbers = options.lineNumbers;
        this.padding = options.padding;
        this.fontSize = options.fontSize;
        this.language = options.language;
        this.scaleFactor = options.scaleFactor;
        this.value = currentValue;
        //<<<<<<<<<< INITIALIZE STATE <<<<<<<<<<

        render = doRender
        // () => {
            // requestAnimationFrame(doRender);
        // };
        doRender();

        // This is done last so that controls that have errored
        // out during their setup don't get added to the control
        // manager.
        Primrose.add(element, this);
    }
}

/// <summary>
/// Registers a new Primrose editor control with the Event Manager, to wire-up key, clipboard, and mouse wheel events, and to manage the currently focused element.
/// The Event Manager maintains the references in a WeakMap, so when the JS Garbage Collector collects the objects, they will be gone.
/// Multiple objects may be used to register a single control with the Event Manager without causing issue.This is useful for associating the control with closed objects from other systems, such as Three.js Mesh objects being targeted for pointer picking.
/// If you are working with Three.js, it's recommended to use the Mesh on which you are texturing the canvas as the key when adding the editor to the Event Manager.
/// </summary>
Primrose.add = (key, control) => {
    if (key !== null) {
        elements.set(key, control);
    }

    if (controls.indexOf(control) === -1) {
        controls.push(control);
        publicControls = Object.freeze(controls.slice());

        control.addEventListener("blur", () => {
            focusedControl = null;
        });

        control.addEventListener("focus", () => {
            // make sure the previous control knows it has
            // gotten unselected.
            if (focusedControl !== null
                && (!focusedControl.isInDocument
                    || !control.isInDocument)) {
                focusedControl.blur();
            }
            focusedControl = control;
        });

        control.addEventListener("over", () => {
            hoveredControl = control;
        });

        control.addEventListener("out", () => {
            hoveredControl = null;
        });
    }
};

/// <summary>
/// Checks for the existence of a control, by the key that the user supplied when calling `Primrose.add()`
/// </summary>
Primrose.has = (key) => {
    return elements.has(key);
};

/// <summary>
/// Gets the control associated with the given key.
/// </summary>
Primrose.get = (key) => {
    return elements.has(key)
        ? elements.get(key)
        : null;
};

Object.defineProperties(Primrose, {

    /// <summary>
    /// The current `Primrose` control that has the mouse hovered over it. In 2D contexts, you probably don't need to check this value, but in WebGL contexts, this is useful for helping Primrose manage events.
    /// If no control is hovered, this returns `null`.
    /// </summary>
    hoveredControl: {
        get: () => hoveredControl
    },

    /// <summary>
    /// The current `Primrose` control that has pointer-focus. It will receive all keyboard and clipboard events. In 2D contexts, you probably don't need to check this value, but in WebGL contexts, this is useful for helping Primrose manage events.
    /// If no control is focused, this returns `null`.
    /// </summary>
    focusedControl: {
        get: () => focusedControl
    },

    /// <summary>
    /// An array of all of the `Primrose` editor controls that Primrose currently knows about.
    /// This array is not mutable and is not the array used by the Event Manager. It is a read-only clone that is created whenever the Event Manager registers or removes a new control
    /// </summary.
    editors: {
        get: () => publicControls
    },

    /// <summary>
    /// A `Promise` that resolves when the document is ready and the Event Manager has finished its initial setup.
    /// </summary>
    ready: {
        get: () => ready
    }
});

Object.freeze(Primrose);

requestAnimationFrame(function update() {
    requestAnimationFrame(update);
    for (let i = controls.length - 1; i >= 0; --i) {
        const control = controls[i];
        if (control.isInDocument) {
            if (elements.has(control.element)) {
                control.resize();
            }
            else {
                controls.splice(i, 1);
                publicControls = Object.freeze(controls.slice());
            }
        }
    }
});

const withCurrentControl = (name) => {
    const evtName = name.toLocaleLowerCase(),
        funcName = `read${name}Event`;

    window.addEventListener(evtName, (evt) => {
        if (focusedControl !== null) {
            focusedControl[funcName](evt);
        }
    }, { passive: false });
};

withCurrentControl("KeyDown");
withCurrentControl("KeyPress");
withCurrentControl("KeyUp");
withCurrentControl("Copy");
withCurrentControl("Cut");
withCurrentControl("Paste");

window.addEventListener("wheel", (evt) => {
    const control = focusedControl //|| hoveredControl;
    if (control !== null) {
        control.readWheelEvent(evt);
    }
}, { passive: false });
import { localeMetadata, type MessageKey, type Translate } from "../i18n";
import { renderCloseIcon } from "./rendering";

export function renderAppShell(t: Translate, version: string): string {
	return `
  <main class="shell">
    <section class="stage" aria-label="${t("transformationViewport")}" data-i18n-aria="transformationViewport">
      <canvas class="scene-canvas" aria-label="${t("animatedCoordinateSpace")}" data-i18n-aria="animatedCoordinateSpace"></canvas>
      <div class="mode-switch" role="group" aria-label="${t("dimension")}" data-i18n-aria="dimension">
        <button type="button" data-dimension="2">2D</button>
        <button type="button" data-dimension="3">3D</button>
      </div>
      <div class="view-tools" role="group" aria-label="${t("applicationControls")}" data-i18n-aria="applicationControls">
        <select name="language" data-language aria-label="${t("language")}" data-i18n-aria="language">
          ${localeMetadata.map(({ code, label }) => `<option value="${code}">${label}</option>`).join("")}
        </select>
        <button type="button" data-action="reset-view" data-i18n="resetView">${t("resetView")}</button>
        <button type="button" data-action="open-reset-workspace" aria-haspopup="dialog" data-i18n="resetWorkspace">${t("resetWorkspace")}</button>
        <button type="button" data-action="share" aria-haspopup="dialog" data-i18n="share">${t("share")}</button>
        <button type="button" data-action="open-about" aria-haspopup="dialog" data-i18n="about">${t("about")}</button>
        <span class="share-status" data-share-status role="status" aria-live="polite"></span>
      </div>
    </section>
    <footer class="panel" aria-label="${t("controls")}" data-i18n-aria="controls">
      <section class="control-cluster">
        <fieldset class="animation-block">
          <legend data-i18n="animation">${t("animation")}</legend>
          <div class="animation-body">
            <div class="transport" role="group" aria-label="${t("animationControls")}" data-i18n-aria="animationControls">
              <button type="button" data-action="play" aria-label="${t("applyTransform")}">${t("apply")}</button>
              <button type="button" data-action="reset" aria-label="${t("resetTransform")}" data-i18n="reset" data-i18n-aria="resetTransform">${t("reset")}</button>
            </div>
            <label class="mode-row" for="animation-mode">
              <span class="mode-label" data-i18n="method">${t("method")}</span>
              <select id="animation-mode" name="animation-mode" data-animation-mode aria-label="${t("animationMethod")}" data-i18n-aria="animationMethod">
                <option value="steps" data-i18n="steps">${t("steps")}</option>
                <option value="composed" data-i18n="composed">${t("composed")}</option>
              </select>
            </label>
          </div>
        </fieldset>
        <div class="visibility-toggles">
          <label class="toggle-row" for="show-basis"><span class="toggle-label" data-i18n="basis">${t("basis")}</span><input id="show-basis" name="show-basis" type="checkbox" data-action="toggle-basis" checked /></label>
          <label class="toggle-row" for="show-grid"><span class="toggle-label" data-i18n="grid">${t("grid")}</span><input id="show-grid" name="show-grid" type="checkbox" data-action="toggle-grid" checked /></label>
        </div>
      </section>
      <section class="equation-tray" data-matrix-stack aria-label="${t("transformationEquation")}" data-i18n-aria="transformationEquation"></section>
    </footer>
    <p id="reorder-instructions" class="visually-hidden">${t("reorderInstructions")}</p>
    <div class="visually-hidden" data-reorder-status role="status" aria-live="polite"></div>
    ${renderAboutDialog(t, version)}
    ${renderShareDialogs(t)}
    ${renderResetDialog(t)}
  </main>
`;
}

function renderAboutDialog(t: Translate, version: string): string {
	const guideRow = (key: MessageKey, description: MessageKey) =>
		`<div role="row"><span role="cell"><kbd data-i18n="${key}">${t(key)}</kbd></span><span role="cell" data-i18n="${description}">${t(description)}</span></div>`;
	return `
    <dialog class="about-dialog" aria-labelledby="about-title">
      <div class="about-dialog-content">
        <div class="about-dialog-header">
          <div><p class="about-eyebrow" data-i18n="quickReference">${t("quickReference")}</p><h1 id="about-title" data-i18n="aboutMattriz">${t("aboutMattriz")}</h1></div>
          <button class="about-close" type="button" data-action="close-about" aria-label="${t("close")}" title="${t("close")}" data-i18n-aria="close" data-i18n-title="close">${renderCloseIcon()}</button>
        </div>
        <p class="about-intro" data-i18n="intro">${t("intro")}</p>
        <div class="control-guide" role="table" aria-label="${t("mattrizControls")}" data-i18n-aria="mattrizControls">
          <div class="control-guide-header" role="row"><span role="columnheader" data-i18n="control">${t("control")}</span><span role="columnheader" data-i18n="whatItDoes">${t("whatItDoes")}</span></div>
          <div role="row"><span role="cell"><kbd>2D</kbd> <kbd>3D</kbd></span><span role="cell" data-i18n="switchDimensions">${t("switchDimensions")}</span></div>
          ${guideRow("resetView", "restoreCamera")}
          ${guideRow("apply", "applyDescription")}
          <div role="row"><span role="cell"><kbd data-i18n="pause">${t("pause")}</kbd> <kbd data-i18n="resume">${t("resume")}</kbd></span><span role="cell" data-i18n="pauseDescription">${t("pauseDescription")}</span></div>
          ${guideRow("reset", "resetDescription")}
          ${guideRow("method", "methodDescription")}
          ${guideRow("basis", "basisDescription")}
          ${guideRow("grid", "gridDescription")}
          <div role="row">
            <span class="guide-add-controls" role="cell">
              ${renderGuideAddControl(t("addMatrix"), "M")}
              ${renderGuideAddControl(t("addVector"), "v")}
            </span>
            <span role="cell" data-i18n="addDescription">${t("addDescription")}</span>
          </div>
        </div>
        <section class="interaction-guide expression-guide" aria-labelledby="expression-guide-title">
          <h2 id="expression-guide-title" data-i18n="expressions">${t("expressions")}</h2>
          <p data-i18n="expressionsDescription">${t("expressionsDescription")}</p>
          <dl>
            <div><dt data-i18n="expressionOperators">${t("expressionOperators")}</dt><dd><span class="expression-tokens"><code>+</code><code>-</code><code>*</code><code>/</code><code>^</code><code>( )</code></span><span data-i18n="expressionOperatorsDescription">${t("expressionOperatorsDescription")}</span></dd></div>
            <div><dt data-i18n="expressionFunctions">${t("expressionFunctions")}</dt><dd><span class="expression-tokens"><code>pi</code><code>sqrt(x)</code><code>sin(x)</code><code>cos(x)</code><code>tan(x)</code></span><span data-i18n="expressionFunctionsDescription">${t("expressionFunctionsDescription")}</span></dd></div>
            <div><dt data-i18n="expressionExamples">${t("expressionExamples")}</dt><dd><span class="expression-tokens"><code>1/2</code><code>sqrt(2)/2</code><code>cos(pi/4)</code><code>2^(-3)</code></span></dd></div>
          </dl>
        </section>
        <section class="interaction-guide" aria-labelledby="interaction-guide-title">
          <h2 id="interaction-guide-title" data-i18n="gestures">${t("gestures")}</h2>
          <dl><div><dt data-i18n="reorder">${t("reorder")}</dt><dd data-i18n="reorderDescription">${t("reorderDescription")}</dd></div><div><dt data-i18n="navigate">${t("navigate")}</dt><dd data-i18n="navigateDescription">${t("navigateDescription")}</dd></div></dl>
        </section>
        <footer class="about-links" aria-label="${t("projectLinks")}" data-i18n-aria="projectLinks">
          <div class="about-link-list"><a href="https://github.com/JahsehJ/mattriz" target="_blank" rel="noreferrer">GitHub</a><a href="https://codeberg.org/JahsehJ/mattriz" target="_blank" rel="noreferrer">Codeberg</a></div>
          <small class="about-version">v${version}</small>
        </footer>
      </div>
    </dialog>`;
}

function renderGuideAddControl(label: string, symbol: string): string {
	return `<span class="preset-split guide-add-split" aria-label="${label}"><span class="equation-add-button preset-main guide-add-button"><math aria-hidden="true"><mo>+</mo><mi>${symbol}</mi></math></span><span class="preset-menu" aria-hidden="true"><span class="preset-toggle"></span></span></span>`;
}

function renderShareDialogs(t: Translate): string {
	return `
    <dialog class="share-dialog" aria-labelledby="share-dialog-title"><div class="share-dialog-content"><h1 id="share-dialog-title" data-i18n="shareCopiedTitle">${t("shareCopiedTitle")}</h1><p data-i18n="shareCopiedDescription">${t("shareCopiedDescription")}</p><input class="share-link" type="text" name="share-link" readonly data-share-link aria-label="${t("shareLink")}" data-i18n-aria="shareLink" /><button type="button" data-action="close-share-dialog" data-i18n="close">${t("close")}</button></div></dialog>
    <dialog class="share-error-dialog" aria-labelledby="share-error-title"><div class="share-error-content"><h1 id="share-error-title" data-i18n="invalidShareTitle">${t("invalidShareTitle")}</h1><p data-i18n="invalidShareDescription">${t("invalidShareDescription")}</p><button type="button" data-action="close-share-error" data-i18n="close">${t("close")}</button></div></dialog>`;
}

function renderResetDialog(t: Translate): string {
	return `<dialog class="reset-workspace-dialog" aria-labelledby="reset-workspace-title"><div class="reset-workspace-content"><h1 id="reset-workspace-title" data-i18n="resetWorkspaceTitle">${t("resetWorkspaceTitle")}</h1><p data-i18n="resetWorkspaceDescription">${t("resetWorkspaceDescription")}</p><div class="reset-workspace-actions"><button type="button" data-action="close-reset-workspace" data-i18n="cancel">${t("cancel")}</button><button class="danger-button" type="button" data-action="confirm-reset-workspace" data-i18n="confirmResetWorkspace">${t("confirmResetWorkspace")}</button></div></div></dialog>`;
}

/**
 * Add custom functions to jQuery
 */
function addFunctionsTojQuery() {
    (function ($) {
        /**
         * Serialize form as json object
         */
        $.fn.serializeFormJSON = function () {
            let self = this,
                json = {},
                push_counters = {},
                patterns = {
                    validate: /^[a-zA-Z][a-zA-Z0-9_]*(?:\[(?:\d*|[a-zA-Z0-9_]+)\])*$/,
                    key: /[a-zA-Z0-9_]+|(?=\[\])/g,
                    push: /^$/,
                    fixed: /^\d+$/,
                    named: /^[a-zA-Z0-9_]+$/,
                };

            this.build = function (base, key, value) {
                base[key] = value;
                return base;
            };

            this.push_counter = function (key) {
                if (push_counters[key] === undefined) {
                    push_counters[key] = 0;
                }
                return push_counters[key]++;
            };

            $.each($(this).serializeArray(), function () {
                // skip invalid keys
                if (!patterns.validate.test(this.name)) {
                    return;
                }

                let k,
                    keys = this.name.match(patterns.key),
                    merge = this.value,
                    reverse_key = this.name;

                while ((k = keys.pop()) !== undefined) {
                    // adjust reverse_key
                    reverse_key = reverse_key.replace(
                        new RegExp("\\[" + k + "\\]$"),
                        ""
                    );

                    // push
                    if (k.match(patterns.push)) {
                        merge = self.build(
                            [],
                            self.push_counter(reverse_key),
                            merge
                        );
                    }

                    // fixed
                    else if (k.match(patterns.fixed)) {
                        merge = self.build([], k, merge);
                    }

                    // named
                    else if (k.match(patterns.named)) {
                        merge = self.build({}, k, merge);
                    }
                }

                json = $.extend(true, json, merge);
            });

            return json;
        };
    })(jQuery);
}

/**
 * Copy a string to clipboard
 * @param {string} str - text to copy
 */
function copyStringToClipboard(str) {
    // Create new element
    let el = document.createElement("textarea");
    // Set value (string to be copied)
    el.value = str;
    // Set non-editable to avoid focus and move outside of view
    el.setAttribute("readonly", "");
    el.style = { position: "absolute", left: "-9999px" };
    document.body.appendChild(el);
    // Select text inside element
    el.select();
    // Copy text to clipboard
    document.execCommand("copy");
    // Remove temporary element
    document.body.removeChild(el);
}

/**
 * Show the toast notification
 * @param {json} message - message informations
 * @param {json} message.reason - message text
 */
function operation_alert(message) {
    $("#notification-body").html("<strong>" + message.reason + "</strong>");
    $("#notification").toast("show");
}

/**
 * @global
 * Place object layout
 */
var layout;

/**
 * @global
 * Place the ID of the current shown editor
 */
var idEditor = "editor1";

/**
 * @global
 * Project name
 */
var projectName = "LoIDE_Project";

/**
 * @global
 * Default font size editor
 */
const defaultFontSize = 15;

/**
 * @global
 * Default ace theme
 */
const defaultTheme = "ace/theme/tomorrow";
const defaultDarkTheme = "ace/theme/idle_fingers";

/**
 * Set up ace editors into object
 */
var editors = {};

/**
 * @global
 * ID value of the clicked button 'submit'
 */
var clkBtn = "";

/**
 * @global
 * Default screens sizes and activated status
 */
var display = {
    small: { size: 576, isActive: false },
    medium: { size: 768, isActive: false },
    large: { size: 992, isActive: true },
};

/**
 * Initialize the LoIDE application
 */
function initializeLoide() {
    /**
     *  Check the screen type,
     *  set the new height of the page and
     *  adjust the layout based on the screen dimensions.
     */
    $(window).resize(function () {
        checkScreenType();
        setNewVhSize();
        resizeWindow();
    });

    // Active tooltip bootstrap
    $('[data-toggle="tooltip"]').tooltip();

    // initialize the first ace editor in the first tab
    setUpAce(idEditor, "");

    // throw Error("hatta");
    setNewVhSize();

    // Resize the window when the user rotates the screen
    window.addEventListener("orientationchange", function () {
        $(window).trigger("resize"); // it has to set the new Vh screen size!
    });

    checkScreenType();

    initializeToastNotifications();

    setClipboard();

    initializePopovers();

    initializeTabEditor();

    initializeTabContextmenu();

    initializeToolbar();

    setWindowResizeTrigger();

    initializeCheckTabToRun();

    initializeLayout();

    initializeShortcuts();

    restoreOutputPaneLayout();

    initializeDropzone();

    initializeNavbar();

    initializeRunSettings();

    initializeSnippets();

    setLoideStyleMode();

    checkProjectOnLocalStorage();

    setAceMode();

    closeRunSettingsOnMobile();

    resetRunSettings();

    initializeAppearanceSettings();

    initializeOutputPane();

    setOuputPaneSize();

    // Select and active the first tab
    $("#editor-tabs li:first-child a").tab("show");

    // Save the button ID that clicked on submit buttons
    $('button[type="submit"]').click(function (evt) {
        clkBtn = evt.target.id;
    });

    $("#input").submit(function (e) {
        e.preventDefault();
        switch (clkBtn) {
            case "run":
                $("#output-model").empty();
                $("#output-error").empty();
                $("#output-model").text("Sending..");
                callSocketServer(false);
                break;

            default:
                break;
        }
    });

    // Move down the output pane on mobile screens
    if (display.small.isActive) {
        $("#split").trigger("click");
    }

    // Hide the splashscreen and remove it from the DOM
    setTimeout(() => {
        loadFromURL();

        $(".splashscreen").fadeOut(function () {
            $(this).remove();
        });
    }, 500);
}

// Initialize the connection to the LoIDE WebSocket Server API and the application
try {
    $(document).ready(function () {
        try {
            addFunctionsTojQuery();
            setupAPI();
            initializeLoide();
        } catch (error) {
            showStartUpError(error);
        }
    });
} catch (error) {
    showStartUpError(error);
}

/**
 * Setup the APIs connections to the LoIDE API Server
 */
function setupAPI() {
    API.createSocket((problem) => {
        operation_alert(problem);
        $("#output-model").text("");
        $("#output-error").text(problem.reason);
    });

    API.setGetLanguagesListener((data) => {
        // This function sets the languages data into the DOM and load the languages on the Run Settings

        let servicesContainer = $("#servicesContainer");
        servicesContainer.empty();
        for (let lang of data) {
            let langOption = $("<option>", { value: lang.value }).text(
                lang.name
            );
            servicesContainer.append(langOption);
            let langDiv = $("<div>", { name: "solvers", value: lang.value });

            servicesContainer.append(langDiv);

            for (let solver of lang.solvers) {
                let solverOption = $("<option>", { value: solver.value }).text(
                    solver.name
                );
                let solverDiv = $("<div>", {
                    name: "executors",
                    value: solver.value,
                });
                langDiv.append(solverOption);
                langDiv.append(solverDiv);

                for (let executor of solver.executors) {
                    let executorOption = $("<option>", {
                        value: executor.value,
                    }).text(executor.name);
                    solverDiv.append(executorOption);
                }

                let optionDiv = $("<div>", {
                    name: "options",
                    value: solver.value,
                });
                langDiv.append(optionDiv);

                for (let option of solver.options) {
                    let optionOption = $("<option>", {
                        value: option.value,
                        word_argument: option.word_argument,
                        title: option.description,
                    }).text(option.name);
                    optionDiv.append(optionOption);
                }
            }
        }
        loadLanguages();
    });

    API.setRunProjectListener(
        (response) => {
            // This function puts the output data on the output panel
            if (response.error == "") {
                $("#output-model").text(response.model); // append the response in the container
                let outputPos = localStorage.getItem("outputPos");
                outputPos = outputPos !== null ? outputPos : "east";

                if (outputPos == "east") {
                    layout.open("east");
                } else {
                    layout.open("south");
                }
            } else {
                $("#output-model").text(response.model);
                $("#output-error").text(response.error);
            }
        },
        (response) => {
            // This function shows the execution problem on the output panel and in a toast notification

            operation_alert(response);
            $("#output-error").text(response.reason); // append the response in the container
            $("#output-model").text(""); // append the response in the container
        }
    );

    API.emitGetLanguages();
}

/**
 * Stop the loading spinner and show the error message
 * @param error - Error object
 * @param error.message - Error description
 */
function showStartUpError(error) {
    document.getElementById("spinner-loading").remove();
    document.getElementById("splashscreen-error-message").style.display =
        "block";

    //     if (error.message.length > 0)
    //         document.getElementById("log-problem").innerText =
    //             "Error description: " + error.message;
}

/**
 * Returns the the solver's option jQuery element based on the current language and solver
 * @returns {jQuery}
 */
function getSolverOptionDOMElement() {
    let $rowOption = $("<div>", { class: "row row-option" });

    let $colForm = $("<div>", { class: "col-sm-12 form-group" });
    $rowOption.append($colForm);

    let $divBadge = $("<div>", { class: "badge-option mb-1" });
    $divBadge.append(
        $("<span>", {
            class: "text-center badge badge-info option-number",
        })
    );
    $divBadge.append(
        $("<span>", {
            class: "text-center badge badge-danger btn-del-option ml-1",
        }).append($("<i>", { class: "fa fa-trash-o" }))
    );

    $colForm.append($divBadge);

    let optionList = getHTMLFromJQueryElement(
        getSolverOptions($("#inputLanguage").val(), $("#inputengine").val())
    );

    let $divInputGroupOpname = $("<div>", {
        class: "input-group opname",
    }).append(
        $("<select>", {
            class: "form-control form-control-option custom-select not-alone",
            name: "option[0][name]",
        }).append($(optionList))
    );

    $colForm.append($divInputGroupOpname);

    $colForm.append($("<div>", { class: "option-values" }));

    return $rowOption;
}

/**
 *  Save the project on localstorage before unloading the page
 */
window.onbeforeunload = function () {
    saveProjectToLocalStorage();
};

/**
 *  Get the viewport height and multiples it by 1% to get a value for a vh unit,
 *  then set the value in the --vh custom property to the root of the document.
 */
function setNewVhSize() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
}

/**
 *  Adjust the output panel position based on the screen dimensions
 *  and resize the Ace editors
 */
function resizeWindow() {
    let fontSizeO = localStorage.getItem("fontSizeO");
    fontSizeO = fontSizeO !== "" ? fontSizeO : defaultFontSize;

    let outputPos = localStorage.getItem("outputPos");
    outputPos = outputPos !== null ? outputPos : "east";

    if (window.innerWidth > display.medium.size) {
        if (outputPos == "south") {
            layout.removePane("south");
            let currentValModel = $("#output-model").text();
            let currentValError = $("#output-error").text();
            $(".ui-layout-south").empty();
            layout.addPane("east");
            createOutputArea($(".ui-layout-east"));
            $("#font-output-range").val(fontSizeO);
            $("#output").css("font-size", fontSizeO + "px");
            $("#output-model").text(currentValModel);
            $("#output-error").text(currentValError);
            saveOption("outputPos", "east");
            setOuputPaneSize();
        }
    } else {
        if (outputPos == "east") {
            layout.removePane("east");
            let currentValModel = $("#output-model").text();
            let currentValError = $("#output-error").text();
            $(".ui-layout-east").empty();
            layout.addPane("south");
            createOutputArea($(".ui-layout-south"));
            $("#font-output-range").val(fontSizeO);
            $("#output").css("font-size", fontSizeO + "px");
            $("#output-model").text(currentValModel);
            $("#output-error").text(currentValError);
            $("#split").children().attr("class", "fa fa-chevron-up");
            $("#split").attr("id", "split-up");
            saveOption("outputPos", "south");
            setOuputPaneSize();
        }
    }

    setTimeout(function () {
        resizeAllEditorsAndLayout();
    }, 900);
}

/**
 * Resize editors dimensions of all Ace editor istances
 */
function resizeAllEditorsAndLayout() {
    layout.resizeAll();
    for (const editor in editors) {
        editors[editor].resize();
    }
}

/**
 * Set output pane size based on screen dimensions
 */
function setOuputPaneSize() {
    let outputPos = localStorage.getItem("outputPos");
    outputPos = outputPos !== null ? outputPos : "east";

    if (display.small.isActive) {
        if (outputPos == "east") {
            layout.sizePane("east", 100);
        } else {
            layout.sizePane("south", 200);
        }
    } else if (display.medium.isActive) {
        if (outputPos == "east") {
            layout.sizePane("east", 200);
        } else {
            layout.sizePane("south", 200);
        }
    } else {
        if (outputPos == "east") {
            layout.sizePane("east", 250);
        } else {
            layout.sizePane("south", 200);
        }
    }
}

/**
 * Returns an object containing the current values of run settings
 * @returns {Object}
 */
function getRunSettingsData() {
    $("#run-dot").attr("name", "runAuto");
    let form = $("#input").serializeFormJSON();
    form.tab = [];

    $(".check-run-tab.checked").each(function (index, element) {
        form.tab.push($(this).val());
    });

    if (form.tab.length == 0) {
        delete form.tab;
    }

    $("#run-dot").removeAttr("name");

    return form;
}

/**
 * Initialize the layout pane of the editor and output sections
 */
function initializeLayout() {
    layout = $("#layout").layout({
        onresize_end: function () {
            for (const editor in editors) {
                editors[editor].resize();
            }
        },
        south__minSize: 125,
        east__minSize: 100,
        resizeWhileDragging: true,
        resizable: true,
        slidable: true,
    });
}

/**
 * Initialize the tooltips on the Open, Save and Share navbar buttons
 */
function initializeNavbarTooltips() {
    $("[rel='tooltip']").tooltip();

    // Hidden tooltip when button is clicked
    $('[data-toggle="tooltip"]').on("click", function () {
        $(this).tooltip("hide");
    });

    $('[rel="tooltip"]').on("click", function () {
        $(this).tooltip("hide");
    });
}

/**
 * Initialize the navbar buttons
 */
function initializeNavbar() {
    // refresh the page if the logo on navbar is clicked
    $(".navbar-logo").on("click", function (e) {
        location.reload();
    });

    $("#btn-save").on("click", function () {
        $(window).trigger("resize");
    });

    $("#btn-run-nav").click(function (e) {
        e.preventDefault();
        $("#output-model").empty();
        $("#output-error").empty();
        $("#output-model").text("Sending..");
        callSocketServer();
    });

    $("#btn-run-settings").click(function () {
        toggleRunSettings();
    });

    initializeNavbarTooltips();
}

/**
 * Initialize the run settings pane
 */
function initializeRunSettings() {
    // Set the solvers and options on language change
    $("#inputLanguage").on("change", function () {
        initializeAutoComplete();
        loadLanguageSolvers();
        setAceMode();
    });

    // Set the options on solver change
    $("#inputengine").on("change", function (event) {
        loadSolverOptions();
        loadSolverExecutors();
        // Snippets
        initializeSnippets();
    });

    $("#reset-run-settings").click(function () {
        resetRunSettings();
    });

    $("#btn-add-option").on("click", function () {
        addOptionDOM();
        remunerateSelectOptionsAndBadge();
        setElementsColorMode();
    });

    $(document).on("click", ".btn-del-option", function () {
        delOptionDOM($(this));
        setElementsColorMode();
    });

    $(document).on("click", ".btn-del-value", function () {
        deleteInputValue($(this));
        setElementsColorMode();
    });

    $(document).on("click", ".btn-add", function () {
        addInputValue($(this).parent());
        setElementsColorMode();
    });

    // Add or remove the 'input type value' based on the option
    $(document).on("change", ".form-control-option", function () {
        let val = $(this).val();

        if (
            $(this)
                .find("[value='" + val + "']")
                .attr("word_argument") == "true"
        ) {
            if (
                $(this)
                    .closest(".row-option")
                    .find(".option-values")
                    .find(".option-value").length <= 0
            ) {
                if (addInputValue($(this).parent()))
                    $(this).addClass("not-alone");
            }
            setElementsColorMode();
        } else {
            $(this).removeClass("not-alone");
            $(this).closest(".row-option").find(".option-value").remove();
            $(this).closest(".row-option").find(".btn-add").remove();
        }
    });
}

/**
 * Initialize the tab button of the editor
 */
function initializeTabEditor() {
    // Delete the editor tab
    $(document).on("click", ".delete-tab", function (e) {
        deleteTab($(this), false);
    });

    // Set the new editor ID related to the tab that will be shown
    $(document).on("shown.bs.tab", 'a[data-toggle="tab"]', function (e) {
        let currentTab = e.target;
        if ($(this).hasClass("btn-tab")) {
            let idTab = $(currentTab).attr("data-target");
            idEditor = $($.find(idTab)).find(".ace").attr("id");
            editors[idEditor].focus();
        }
    });
}

/**
 * Initialize the tab output pane
 */
function initializeOutputPane() {
    // Highlight the words on the output pane of the model output.
    $(document).on("mouseup", "#output-model", function () {
        $("#output-model").unmark();
        let start, end;
        let text = $("#output-model").text();
        let mainDiv = document.getElementById("output-model");
        let sel = getSelectionCharOffsetsWithin(mainDiv);
        start = sel.start;
        end = sel.end;

        let preChart = text.slice(start - 1, start);
        let postChart = text.slice(end, end + 1);
        let selected = text.slice(start, end);
        let isPreChartCompliance = preChart.match(/[\{\s\,]/g);
        let isPostChartCompliance = postChart.match(/[\(\s\,]/g);
        let isSelectedWordCompliance = !selected.match(/[\s\(\)\,]/g);
        if (
            isPreChartCompliance &&
            isPostChartCompliance &&
            isSelectedWordCompliance
        ) {
            let regex = new RegExp(
                "([\\s\\{\\,])(" + selected + ")([\\(\\,\\s])",
                "g"
            );
            text = text.replace(regex, "$1<mark>$2</mark>$3");
            $("#output-model").empty();
            $("#output-model").html(text);
            let randomColor = Math.floor(Math.random() * 16777215).toString(16);
            $("mark").css("color", "#" + randomColor);
        }
    });

    // Set the event on click that downloads the output on a text file
    $(document).on("click", "#dwn-output", function () {
        downloadOutput();
    });

    // Set the event on click that clears the output
    $(document).on("click", "#clear-output", function () {
        $("#output-model").empty();
        $("#output-error").empty();
    });

    // Set the event on click that move the output pane to under of the editor
    $(document).on("click", "#split", function () {
        addSouthLayout(layout);
        setOuputPaneSize();
    });

    // Set the event on click that move the output pane to right of the editor
    $(document).on("click", "#split-up", function () {
        addEastLayout(layout);
        setOuputPaneSize();
    });
}

/**
 * Check the screen size and set if the screen is small or medium or large
 */
function checkScreenType() {
    if ($(window).width() < display.medium.size) {
        display.small.isActive = true;
        display.medium.isActive = false;
        display.large.isActive = false;
    } else if ($(window).width() < display.large.size) {
        display.small.isActive = false;
        display.medium.isActive = true;
        display.large.isActive = false;
    } else {
        display.small.isActive = false;
        display.medium.isActive = false;
        display.large.isActive = true;
    }
}

/**
 * Initialize buttons and inputs of the Appearance Settings modal
 */
function initializeAppearanceSettings() {
    $("#dark-light-mode").click(function () {
        localStorage.setItem(
            "mode",
            (localStorage.getItem("mode") || "dark") === "dark"
                ? "light"
                : "dark"
        );
        localStorage.getItem("mode") === "dark"
            ? document.querySelector("body").classList.add("dark")
            : document.querySelector("body").classList.remove("dark");
        setElementsColorMode();
        $("#theme").change();
    });

    $("#font-editor-range").change(function (e) {
        let value = e.target.value;
        setFontSizeEditors(value);
        if (!saveOption("fontSizeE", value)) {
            alert("Sorry, this options will not save in your browser");
        }
    });

    $("#font-output-range").change(function (e) {
        let value = e.target.value;
        $("#output").css("font-size", value + "px");
        if (!saveOption("fontSizeO", value)) {
            alert("Sorry, this options will not save in your browser");
        }
    });

    $("#theme").change(function (e) {
        let theme = $(this).val();
        setEditorTheme(theme);
        if (!saveOption("theme", theme)) {
            alert("Sorry, this options will not save in your browser");
        }
    });

    $("#reset-appearance-settings").click(function () {
        resetAppearanceSettings();
    });

    if (supportLocalStorage()) {
        let theme = localStorage.getItem("theme");
        theme = theme !== null ? theme : defaultTheme;
        $("#theme").val(theme).change();

        let fontSizeE = localStorage.getItem("fontSizeE");
        fontSizeE = fontSizeE !== "" ? fontSizeE : defaultFontSize;
        $("#font-editor-range").val(fontSizeE).change();

        let fontSizeO = localStorage.getItem("fontSizeO");
        fontSizeO = fontSizeO !== "" ? fontSizeO : defaultFontSize;
        $("#font-output-range").val(fontSizeO).change();

        let actualTheme =
            localStorage.getItem("theme") == null
                ? ""
                : localStorage.getItem("theme");
        if (actualTheme.length === 0) {
            if (localStorage.getItem("mode") === "dark")
                setEditorTheme(defaultDarkTheme);
            else {
                setEditorTheme(defaultTheme);
            }
        } else {
            setEditorTheme(actualTheme);
        }
    } else {
        $("#font-editor-range").val(defaultFontSize).change();
        $("#font-output-range").val(defaultFontSize).change();
    }
}

/**
 * Initialize the "Current Tab" and the tab items on the "choose tab to execute" list.
 */
function initializeCheckTabToRun() {
    $(".check-run-tab:not(.check-auto-run-tab)").off();
    $(".check-auto-run-tab").off();

    checkCurrentTabSelected();

    $(".check-run-tab:not(.check-auto-run-tab)").on("click", function (e) {
        $(this).find(".check-icon").toggleClass("invisible");
        $(this).toggleClass("checked");
        checkCurrentTabSelected();
    });

    $(".check-auto-run-tab").on("click", function (e) {
        $(".check-run-tab.checked:not(.check-auto-run-tab)").each(function () {
            $(this).removeClass("checked");
            $(this).find(".check-icon").toggleClass("invisible");
        });
        $(this).find(".check-icon").removeClass("invisible");
        $(this).addClass("checked");
        checkCurrentTabSelected();
    });
}

/**
 * Select the "Current Tab" item if there are no tabs selected.
 */
function checkCurrentTabSelected() {
    let tot = $(".check-run-tab.checked:not(.check-auto-run-tab)").length;
    if (tot === 0) {
        $(".check-auto-run-tab").find(".check-icon").removeClass("invisible");
        $(".check-auto-run-tab").addClass("checked");
    } else {
        $(".check-auto-run-tab").find(".check-icon").addClass("invisible");
        $(".check-auto-run-tab").removeClass("checked");
    }
}

/**
 * Serialize the input form and send it to socket server and waits for the response
 */
function callSocketServer(onlyActiveTab) {
    $(".tab-pane").each(function (index, element) {
        let id = $(this).find(".ace").attr("id");
        editors[id].replaceAll("", { needle: "'" });
    });
    if (onlyActiveTab || !addMorePrograms()) {
        let text = editors[idEditor].getValue();
        $("#program").val(text); // insert the content of text editor in a hidden input text to serailize
    }
    let form = $("#input").serializeFormJSON();
    if (form.option == null) {
        form.option = [{ name: "" }];
    }
    destroyPrograms();

    API.emitRunProject(form);
}

/**
 * Trigger a 'run' button to execute the project
 */
function intervalRun() {
    $("#run").trigger("click");
}

/**
 * Create a new Blob that contains the data from your form feild, then create a link object to attach the file to download
 * @param {string} text - configuration project in JSON string format to be saved
 * @param where - where the file will be saved
 * @param name - name of the file
 * @param type - type of the file
 */
function createFileToDownload(text, where, name, type) {
    let textFileAsBlob = new Blob([text], {
        type: "application/" + type,
    });
    /**
     * specify the name of the file to be saved
     */
    let fileNameToSaveAs = name + "." + type;
    let downloadLink = document.createElement("a");

    /**
     * supply the name of the file
     */
    downloadLink.download = fileNameToSaveAs;

    /**
     * allow code to work in webkit & Gecko based browsers without the need for a if / else block.
     */
    window.URL = window.URL || window.webkitURL;
    downloadLink.href = window.URL.createObjectURL(textFileAsBlob);

    /**
     * when link is clicked, call the function to remove it from the DOM in case user wants to save a second file
     */
    downloadLink.onclick = destroyClickedElement;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);

    switch (where) {
        case "local":
            downloadLink.click();
            break;

        default:
            break;
    }
}
/**
 * Remove the link from the DOM
 * @param {Object} event - reference to the object that dispatched the event
 */
function destroyClickedElement(event) {
    document.body.removeChild(event.target);
}

/**
 * Initialize the Open file dropzone.
 */
function initializeDropzone() {
    $("#upload-container").on("shown.bs.collapse", function () {
        $(window).trigger("resize");
    });

    $("#upload-container").on("hidden.bs.collapse", function () {
        $(window).trigger("resize");
    });

    let dropZone = document.getElementById("drop_zone");
    dropZone.addEventListener(
        "dragover",
        function (evt) {
            evt.stopPropagation();
            evt.preventDefault();
            evt.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
        },
        false
    );
    dropZone.addEventListener("drop", handleFileSelect, false);
    document
        .getElementById("files")
        .addEventListener("change", handleFileSelect, false);
}

/**
 * Initialize the context menu of every editor tab.
 */
function initializeTabContextmenu() {
    $.contextMenu({
        selector: ".btn-context-tab",
        zIndex: 10,
        items: {
            RunThisTab: {
                name: "Run",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-play context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    runCurrentTab();
                },
            },
            Rename: {
                name: "Rename",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-pencil context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    closeAllPopovers();
                    opt.$trigger.parent().popover("show");
                },
            },
            Duplicate: {
                name: "Duplicate",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-clone context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    let textToDuplicate = editors[idEditor].getValue();
                    let tabID = addEditorTab(textToDuplicate);
                    $("[data-target='#" + tabID + "']").tab("show"); //active last tab inserted
                },
            },
            Clear: {
                name: "Clear content",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-eraser context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    editors[idEditor].setValue("");
                },
            },
            SaveTabContent: {
                name: "Save content",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-download context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    downloadCurrentTabContent();
                },
            },
            Delete: {
                name: "Delete",
                icon: function (opt, $itemElement, itemKey, item) {
                    // Set the content to the menu trigger selector and add an bootstrap icon to the item.
                    $itemElement.empty();
                    $itemElement.append(
                        $("<i>", {
                            class: "fa fa-times context-menu-item-icon",
                            "aria-hidden": "true",
                        })
                    );
                    $itemElement.append(item.name);

                    // Add the context-menu-icon-updated class to the item
                    return "context-menu-icon-updated";
                },
                callback: function (itemKey, opt, e) {
                    opt.$trigger.parent().find(".delete-tab").trigger("click");
                },
            },
        },
        events: {
            show: function (e) {
                $(this).parent().trigger("click");
            },
        },
    });

    $(".btn-context-tab").off();
    $(".btn-context-tab").on("click", function (e) {
        $(this).trigger("contextmenu");
        e.stopPropagation();
        e.preventDefault();
    });

    $(".btn-tab").popover({
        title: "Rename",
        container: "body",
        trigger: "manual",
        html: true,
        placement: "bottom",
    });

    // initialize change tab name popopver
    $(".btn-tab").off("inserted.bs.popover");
    $(".btn-tab").on("inserted.bs.popover", function () {
        let $renameTabBody = $("<div>", { class: "input-group" });

        $renameTabBody.append(
            $("<input>", {
                type: "text",
                class: "form-control",
                id: "change-name-tab-textbox",
                placeholder: "Type a name",
            })
        );
        $renameTabBody.append(
            $("<span>", { class: "input-group-btn" }).append(
                $("<button>", {
                    class: "btn btn-light",
                    type: "button",
                    id: "change-name-tab",
                }).append($("<i>", { class: "fa fa-chevron-right" }))
            )
        );

        $(".popover-header").remove();
        $(".popover-body")
            .last()
            .append($("<h6>", { class: "mb-2" }).text("Rename"));
        $(".popover-body").last().append($renameTabBody);

        // set the color of buttons if the darkmode is on
        if (localStorage.getItem("mode") === "dark") {
            $("#change-name-tab").removeClass("btn-light");
            $("#change-name-tab").addClass("btn-dark");
        } else {
            $("#change-name-tab").removeClass("btn-dark");
            $("#change-name-tab").addClass("btn-light");
        }

        // focus the input text box
        $("#change-name-tab-textbox").focus();
        let thisTab = $(this);
        let idTabEditor = $(this).attr("data-target");
        let idEditorToChangeTabName = $($.find(idTabEditor))
            .children()
            .attr("id");

        // disable the enter button
        $("#change-name-tab").prop("disabled", true);

        $("#change-name-tab-textbox").off("input");
        // add event for disable the enter button if there are no letters in the input text box
        $("#change-name-tab-textbox").on("input", function () {
            let nameValue = $("#change-name-tab-textbox").val().trim();
            if (nameValue.length === 0) {
                $("#change-name-tab").prop("disabled", true);
            } else {
                $("#change-name-tab").prop("disabled", false);
            }
        });

        $("#change-name-tab").off("click");
        // add event to change the tab name when the enter button is clicked
        $("#change-name-tab").on("click", function () {
            let nameValue = $("#change-name-tab-textbox").val().trim();
            if (nameValue.length !== 0) {
                $('.check-run-tab[value="' + idEditorToChangeTabName + '"]')
                    .find(".check-tab-name")
                    .text(nameValue);
                thisTab.children(".name-tab").text(nameValue);
                thisTab.popover("hide");
            }
        });

        $("#change-name-tab-textbox").off("keyup");
        // change the name tab when the user digit the enter key from the keyboard
        $("#change-name-tab-textbox").on("keyup", function (e) {
            if (e.key == "Enter") {
                $("#change-name-tab").trigger("click");
            }
        });
    });
    $(".name-tab").off("contextmenu");
    // show the contest menu on right click on the tab name
    $(".name-tab").on("contextmenu", function (e) {
        $(e.target).siblings(".btn-context-tab").trigger("click");
        return false; // don't show the contest menu of the browser
    });
}

/**
 * Load the languages
 */
function loadLanguages() {
    let inputLanguage = $("#inputLanguage");

    inputLanguage.empty();
    inputLanguage.append(getLanguages());
    inputLanguage.change();
}

/**
 * Get the available languages from the HTML hidden configuration elements
 */
function getLanguages() {
    return $("#servicesContainer > option").clone();
}

/**
 * Load the solvers for a specific language
 */
function loadLanguageSolvers() {
    let language = $("#inputLanguage").val();
    let inputSolver = $("#inputengine");

    // Check that the value is not empty
    if (language !== "") {
        // Clear the values
        inputSolver.empty();
        $(".form-control-option").empty();

        // Load the solvers
        inputSolver.append(getLanguageSolvers(language));

        // Call the listener and select the first value
        inputSolver.change();
    }
}

/**
 * Get the solvers for a specific language from the HTML hidden configuration elements
 * @param {string} language - language value
 */
function getLanguageSolvers(language) {
    return $(
        '#servicesContainer [name="solvers"][value="' + language + '"] > option'
    ).clone();
}

/**
 * Load the executors for a specific solver
 */
function loadSolverExecutors() {
    let inputLanguage = $("#inputLanguage");
    let inputSolver = $("#inputengine");
    let inputExecutor = $("#inputExecutor");

    let language = inputLanguage.val();
    let solver = inputSolver.val();

    // Check that the value is not empty
    if (language !== "" && solver !== "") {
        inputExecutor.empty();

        // Append the executors to the DOM
        inputExecutor.append(getSolverExecutors(language, solver));

        // Select the first executor
        inputExecutor.change();
    }
}

/**
 * Get the executors for a specific solver from the HTML hidden configuration elements
 * @param {string} language - language value
 * @param {string} solver - solver value
 */
function getSolverExecutors(language, solver) {
    return $(
        '#servicesContainer [name="solvers"][value="' +
            language +
            '"] [name="executors"][value="' +
            solver +
            '"] > option'
    ).clone();
}

/**
 * Load the options for a specific solver
 */
function loadSolverOptions() {
    let inputLanguage = $("#inputLanguage");
    let inputSolver = $("#inputengine");

    let language = inputLanguage.val();
    let solver = inputSolver.val();

    // Check that the value is not empty
    if (language !== "" && solver !== "") {
        $(".form-control-option").empty();

        // Append the options to the DOM
        $(".row-option .form-control-option").append(
            getSolverOptions(language, solver)
        );

        // Select the first option and refresh all input fields
        $(".form-control-option").change();
    }
}

/**
 * Get the options for a specific solver from the HTML hidden configuration elements
 * @param {string} language
 * @param {string} solver
 */
function getSolverOptions(language, solver) {
    return $(
        '#servicesContainer [name="solvers"][value="' +
            language +
            '"] [name="options"][value="' +
            solver +
            '"] > option'
    ).clone();
}

/**
 * Add east and remove south layout
 */
function addEastLayout(layout) {
    layout.removePane("south");
    saveOption("outputPos", "east");
    let currentValModel = $("#output-model").text();
    let currentValError = $("#output-error").text();
    $("#split-up").parent().empty();
    layout.addPane("east");
    createOutputArea($(".ui-layout-east"));
    let fontSizeO = $("#font-output-range").val();
    fontSizeO = fontSizeO !== "" ? fontSizeO : defaultFontSize;
    $("#font-output-range").val(fontSizeO);
    $("#output").css("font-size", fontSizeO + "px");
    $("#output-model").text(currentValModel);
    $("#output-error").text(currentValError);
}

/**
 * Add south and remove east layout
 */
function addSouthLayout(layout) {
    layout.removePane("east");
    saveOption("outputPos", "south");
    let currentValModel = $("#output-model").text();
    let currentValError = $("#output-error").text();
    $("#split").parent().empty();
    layout.addPane("south");
    createOutputArea($(".ui-layout-south"));
    let fontSizeO = $("#font-output-range").val();
    fontSizeO = fontSizeO !== "" ? fontSizeO : defaultFontSize;
    $("#font-output-range").val(fontSizeO);
    $("#output").css("font-size", fontSizeO + "px");
    $("#output-model").text(currentValModel);
    $("#output-error").text(currentValError);
    $("#split").children().attr("class", "fa fa-chevron-up");
    $("#split").attr("id", "split-up");
}

/**
 * Returns the start and the end position of the selected string in the output container
 * @param {HTMLElement} element - Container where to search
 * @returns {Object}
 */
function getSelectionCharOffsetsWithin(element) {
    let start = 0,
        end = 0;
    let sel, range, priorRange;
    if (typeof window.getSelection != "undefined") {
        range = window.getSelection().getRangeAt(0);
        priorRange = range.cloneRange();
        priorRange.selectNodeContents(element);
        priorRange.setEnd(range.startContainer, range.startOffset);
        start = priorRange.toString().length;
        end = start + range.toString().length;
    } else if (
        typeof document.selection != "undefined" &&
        (sel = document.selection).type != "Control"
    ) {
        range = sel.createRange();
        priorRange = document.body.createTextRange();
        priorRange.moveToElementText(element);
        priorRange.setEndPoint("EndToStart", range);
        start = priorRange.text.length;
        end = start + range.text.length;
    }
    return {
        start: start,
        end: end,
    };
}

/**
 * Delete from the DOM an option block and iterates all of the form options to change their 'name' for a correct json format (if present, included input value)
 * @param {jQuery} deleteButton - jQuery object of the clicked button
 */
function delOptionDOM(deleteButton) {
    let row = $(deleteButton).closest(".row-option");
    row.slideUp(300, function () {
        $(this).remove();
        remunerateSelectOptionsAndBadge();
    });
}

/**
 * Create a new DOM element for the solver's options
 */
function addOptionDOM() {
    let solverOptions = $("#solver-options");

    // Append the DOM element containing the solver's options
    solverOptions.append(getSolverOptionDOMElement());

    // Do a slide animation
    $(".row-option").last().css("display", "none");
    $(".row-option").last().slideDown(200);

    // Select the first option
    $(".row-option .form-control-option").last().change();
}

/**
 * Delete input value to the DOM and if the lenght of the class is equal to one, append the button to add input value
 * @param {jQuery} deleteButton - jQuery object of the clicked button
 */
function deleteInputValue(deleteButton) {
    let inputValue = $(deleteButton).closest(".row-option");
    if (inputValue.find(".option-value").length > 1) {
        deleteButton.parent().remove();
    } else {
        deleteButton.siblings(".option-value").val("");
    }
}

/**
 * Add an input textbox for the option solver
 * @param {jQuery} buttonAddValue - jQuery object of the clicked button
 * @returns {boolean}
 */
function addInputValue(buttonAddValue) {
    let currentName = $(buttonAddValue)
        .closest(".row-option")
        .find(".form-control-option")
        .attr("name");

    if (!/option\[\d\]\[name\]/i.test(currentName)) {
        return false;
    }
    /**
     * replace 'name' in 'value' for correct json format
     * @example currentName=option[0][name] , replaceName=option[0][value][]
     */
    let replaceName = currentName.replace("name", "value");
    replaceName += "[]";

    let $inputGroup = $("<div>", { class: "input-group" });
    $inputGroup.append(
        $("<input>", {
            type: "text",
            class: "form-control form-control-value option-value",
            name: replaceName,
        })
    );
    $inputGroup.append(
        $("<span>", { class: "btn-del-value" }).append(
            $("<i>", { class: "fa fa-trash" })
        )
    );

    buttonAddValue
        .closest(".row-option")
        .find(".option-values")
        .append($inputGroup);

    let $addValueButton = $("<button>", {
        type: "button",
        class: "btn btn-light btn-add btn-block",
    }).append($("<i>", { class: "fa fa-plus" }));
    $addValueButton.append("&nbsp;Add value");

    $(buttonAddValue).siblings(".option-values").after($addValueButton);

    return true;
}

/**
 * Check if the parameters of the config object correspond to a LoIDE project
 * @param {Object} config - project configuration object
 * @returns {boolean}
 *
 */
function isLoideProject(config) {
    if (
        {}.hasOwnProperty.call(config, "language") ||
        {}.hasOwnProperty.call(config, "engine") ||
        {}.hasOwnProperty.call(config, "executor") ||
        {}.hasOwnProperty.call(config, "option") ||
        {}.hasOwnProperty.call(config, "program") ||
        {}.hasOwnProperty.call(config, "output_model") ||
        {}.hasOwnProperty.call(config, "output_error") ||
        {}.hasOwnProperty.call(config, "tabname")
    )
        return true;
    return false;
}

/**
 * Check if the configration file has the correct property to set. If not, return false and display the content of the file in the text editor
 * @param {Object} config - project configuration object
 * @returns {boolean}
 */
function setJSONInput(config) {
    if (isLoideProject(config)) {
        $(".nav-tabs li:not(:last)").each(function (index, element) {
            let id = $(this).find("a").attr("data-target");
            $(this).remove();
            $(id).remove();
            $('.check-run-tab[value="editor' + (index + 1) + '"]').remove();
        });
        let tabID;
        $(config.program).each(function (index, element) {
            tabID = addEditorTab(config.program[index]);
        });
        if ({}.hasOwnProperty.call(config, "tab")) {
            $(config.tab).each(function (index, element) {
                $('.check-run-tab[value="' + element + '"]')
                    .find(".check-icon")
                    .toggleClass("invisible");
                $('.check-run-tab[value="' + element + '"]').toggleClass(
                    "checked"
                );
            });
        }
        if ({}.hasOwnProperty.call(config, "runAuto")) {
            $("#run-dot").prop("checked", true);
        } else {
            $("#run-dot").prop("checked", false);
        }
        $("#inputLanguage").val(config.language).change();
        $("#inputengine").val(config.engine).change();
        $("#inputExecutor").val(config.executor).change();
        $("#output-model").text(config.output_model);
        $("#output-error").text(config.output_error);

        setOptions(config);
        setTabsName(config);
        initializeCheckTabToRun();

        $("#editor-tabs li:first-child a").tab("show"); // select the first tab

        return true;
    } else {
        return false;
    }
}

/**
 * Creates a option's form and append it to the DOM with the corresponding value
 * @param {Object} option - option object
 */
function addOption(option) {
    $("#btn-add-option").trigger("click");
    let lastOption = $(".row-option").last();
    lastOption.find(".form-control-option").val(option.name).change();
    if (option.value != null) {
        option.value.forEach(function (item, index) {
            if (index == 0) {
                lastOption.find(".option-value").last().val(item);
            } else if (index >= 1) {
                lastOption.find(".btn-add").trigger("click");
                lastOption.find(".option-value").last().val(item);
            }
        });
    }
}

/**
 * Check if a string is a JSON
 * @param {string} str - string to check
 * @returns {boolean}
 */
function isJSON(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * Create and returns the output div jQuery element
 * @returns {jQuery}
 */
function getOutputElement() {
    let $outputContainer = $("<div>", { class: "output-container" });

    let $settingOutput = $("<div>", { id: "setting-output" });
    $settingOutput.append("Output");

    let $roleGroup = $("<div>", { class: "float-right", role: "group" });
    $roleGroup.append(
        $("<button>", {
            type: "button",
            id: "dwn-output",
            class: "btn btn-light btn-sm mr-1",
            "data-toggle": "tooltip",
            "data-placement": "bottom",
            title: "Save output",
            "data-delay": '{"show":"700", "hide":"0"}',
        }).append($("<i>", { class: "fa fa-download", "aria-hidden": "true" }))
    );
    $roleGroup.append(
        $("<button>", {
            type: "button",
            id: "clear-output",
            class: "btn btn-light btn-sm mr-1",
            "data-toggle": "tooltip",
            "data-placement": "bottom",
            title: "Clear output",
            "data-delay": '{"show":"700", "hide":"0"}',
        }).append($("<i>", { class: "fa fa-eraser", "aria-hidden": "true" }))
    );
    $roleGroup.append(
        $("<button>", {
            type: "button",
            id: "split",
            class: "btn btn-light btn-sm",
            title: "Split",
        }).append(
            $("<i>", { class: "fa fa-chevron-down", "aria-hidden": "true" })
        )
    );

    let $output = $("<div>", {
        id: "output",
        class: "output",
    });
    $output.append($("<div>", { id: "output-model", class: "pb-2" }));
    $output.append($("<div>", { id: "output-error" }));

    $settingOutput.append($roleGroup);

    $outputContainer.append($settingOutput);
    $outputContainer.append($output);

    return $outputContainer;
}

/**
 * Create the output area in the specific pane layout
 * @param {string} layout - specific pane layout
 */
function createOutputArea(layout) {
    $("#setting-output").remove();
    $(".output-container").remove();
    let $output = getOutputElement();
    $(layout).append($output);
    setLoideStyleMode();
    $("#dwn-output").tooltip();
}

/**
 * Handle the event of a dropzone or an input file box.
 * If the event contains only a single file and it is a project config, it will be loaded.
 * Otherwise the file or file array will be loaded as text in each individual tab of the editor .
 * @param {Object} evt - Event object
 */
function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    let files = document.getElementById("files").files;

    if (files.length === 0) {
        files = evt.dataTransfer.files;
    }

    if (files.length == 1) {
        let reader = new FileReader();
        reader.onload = function (event) {
            let text = event.target.result;
            if (isJSON(text)) {
                let project = JSON.parse(text); // takes content of the file in the response
                if (!setJSONInput(project)) {
                    editors[idEditor].setValue(JSON.stringify(text)); // set value of the file in text editor
                }
                initializeTabContextmenu();
            } else {
                editors[idEditor].setValue(text);
            }
        };
        reader.readAsText(files[0]);
    } else {
        scanFileList(files, createEditorTabs);
    }

    // Remove and close container after success upload
    $(".collapse").collapse("hide");
    $("#files").val("");
}

/**
 * Scan all the file list and create a data object that contains the list of the files name and its contents and it will passed to the callback function.
 * @param {Object[]} files - file object array from a dropzon or an input file box
 * @param callback - callback function called when all files are scanned
 */
function scanFileList(files, callback) {
    let count = files.length; // Total number of files
    let data = {
        names: [],
        texts: [],
    }; // Accepted files

    // Get the selected files
    for (let i = 0; i < count; i++) {
        // Invoke readers
        checkFile(files[i]);
    }

    /**
     * Read the file object and push its file name and content in the data object
     * @param {Object} file - file object
     */
    function checkFile(file) {
        let reader = new FileReader();
        reader.onload = function (event) {
            let text = this.result;
            // Here I parse and check the data and if valid append it to texts
            data.texts.push(text); // Or the original `file` blob..
            data.names.push(file.name);

            if (!--count) callback(data); // When done, invoke callback
        };
        reader.readAsText(file);
    }
}

/**
 * Create new editor tabs for every file data
 * @param data - Infomation about the files
 * @param data.names - Array of file names
 * @param data.texts - Array of file contents
 */
function createEditorTabs(data) {
    let tabOpened = $(".btn-tab").length;
    let tabID;
    let openOnFirst = false;
    for (let index = 0; index < data.texts.length; index++) {
        if (tabOpened == 1) {
            if (index == 0) {
                if (editors[idEditor].getValue().trim() === "") {
                    editors[idEditor].setValue(data.texts[index]);
                    openOnFirst = true;
                } else {
                    tabID = addEditorTab(data.texts[index]);
                }
            } else {
                tabID = addEditorTab(data.texts[index]);
            }
        } else {
            tabID = addEditorTab(data.texts[index]);
        }
    }
    if (tabOpened == 1) {
        $("a[data-target='#tab1']").tab("show");
    } else {
        $("a[data-target='#" + tabID + "']").tab("show"); // active last tab inserted
    }

    $(".name-tab").each(function (index) {
        if (openOnFirst) {
            $(this).text(data.names[index]);
            let id = index + 1;
            let editor = "editor" + id;
            $('.check-run-tab[value="' + editor + '"]')
                .find(".check-tab-name")
                .text(data.names[index]);
        } else {
            if (index > tabOpened - 1) {
                $(this).text(data.names[index - tabOpened]);
                let id = index + 1;
                let editor = "editor" + id;
                $('.check-run-tab[value="' + editor + '"]')
                    .find(".check-tab-name")
                    .text(data.names[index - tabOpened]);
            }
        }
    });
    initializeTabContextmenu();
    setAceMode();
}

/**
 * Set up a new Ace editor
 * @param {string} ideditor - ID of the new editor
 * @param {string} text -  text content of the new editor
 */
function setUpAce(ideditor, text) {
    editors[ideditor] = new ace.edit(ideditor);
    ace.config.set("packaged", true);
    ace.config.set("modePath", "js/ace/mode");
    editors[ideditor].jumpToMatching();
    let actualTheme =
        localStorage.getItem("theme") == null
            ? ""
            : localStorage.getItem("theme");
    if (actualTheme.length == 0) {
        if (localStorage.getItem("mode") === "dark")
            editors[ideditor].setTheme(defaultDarkTheme);
        else {
            editors[ideditor].setTheme(defaultTheme);
        }
    } else {
        editors[ideditor].setTheme(actualTheme);
    }

    editors[ideditor].setValue(text);
    editors[ideditor].clearSelection();
    editors[ideditor].resize();
    editors[ideditor].setBehavioursEnabled(true);
    editors[ideditor].setOptions({
        fontSize: 15,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        cursorStyle: "smooth",
        copyWithEmptySelection: true,
    });

    editors[ideditor].commands.addCommand({
        name: "run",
        bindKey: { win: "Ctrl-enter", mac: "Command-enter" },
        exec: function (editor) {
            intervalRun();
        },
        readOnly: true,
    });

    editors[ideditor].commands.addCommand({
        name: "save",
        bindKey: { win: "ctrl-s", mac: "cmd-s" },
        exec: function (editor) {
            downloadLoDIEProject();
        },
    });

    editors[ideditor].commands.addCommand({
        name: "share",
        bindKey: { win: "ctrl-shift-s", mac: "cmd-shift-s" },
        exec: function (editor) {
            $("#btn-share").trigger("click");
        },
    });

    editors[ideditor].commands.addCommand({
        name: "open",
        bindKey: { win: "ctrl-o", mac: "cmd-o" },
        exec: function (editor) {
            $("#btn-save").trigger("click");
        },
    });

    editors[ideditor].commands.addCommand({
        name: "run-options",
        bindKey: { win: "ctrl-shift-o", mac: "cmd-shift-o" },
        exec: function (editor) {
            $("#btn-run-settings").trigger("click");
        },
    });

    initializeSnippets();

    /**
     * Execute the program when you insert a . and if the readio button is checked
     */
    editors[ideditor].on("change", function (e) {
        if ($("#run-dot").prop("checked")) {
            if (e.lines[0] === ".") {
                intervalRun();
            }
        }
        if (e.lines[0] === "'") {
            operation_alert({ reason: "Single quotes not yet supported" });
            editors[ideditor].replaceAll("", { needle: "'" });
        }
        initializeAutoComplete();
    });
}

/**
 * Initialize shortcuts and set title to the tooltips based on the OS
 */
function initializeShortcuts() {
    Mousetrap.bind("mod+enter", function () {
        $("#run").trigger("click");
        return false;
    });

    Mousetrap.bind("mod+s", function () {
        downloadLoDIEProject();
        return false;
    });

    Mousetrap.bind("mod+o", function () {
        $("#btn-save").trigger("click");
        return false;
    });

    Mousetrap.bind("mod+shift+s", function () {
        $("#btn-share").trigger("click");
        return false;
    });

    Mousetrap.bind("mod+shift+o", function () {
        $("#btn-run-settings").trigger("click");
        return false;
    });

    Mousetrap.bind("?", function () {
        $("#modal-about").modal("hide");
        $("#setting-editor").modal("hide");
        $("#shortcut").modal("show");
    });

    if (window.navigator.userAgent.indexOf("Mac") !== -1) {
        $('[for="run"]').attr("data-original-title", "{ ⌘ + Enter }");
        $("#btn-save").attr("data-original-title", "{ ⌘ + O }");
        $('[for="btn-download"]').attr("data-original-title", "{ ⌘ + S}");
        $("#btn-share").attr("data-original-title", "{ ⌘ + ⇧ + S}");
    } else {
        $('[for="run"]').attr("data-original-title", "{ CTRL + Enter }");
        $("#btn-save").attr("data-original-title", "{ CTRL + O }");
        $('[for="btn-download"]').attr("data-original-title", "{ CTRL + S }");
        $("#btn-share").attr("data-original-title", "{ CTRL + ⇧ + S}");
    }
}

/**
 * Add the programs into the hidden input type to be serialized
 * @returns {boolean}
 */
function addMorePrograms() {
    let check = false;

    $(".check-run-tab.checked:not(.check-auto-run-tab)").each(function (
        index,
        element
    ) {
        check = true;
        let p = editors[$(this).val()].getValue();
        $(".layout").prepend(
            $("<input>", {
                type: "hidden",
                name: `program[${index}]`,
                id: `program${$(this).val()}`,
                value: `${p}`,
                class: "programs",
            })
        );
    });

    if (check) {
        $("#program").remove();
    }
    return check;
}

/**
 * Adds the programs into the hidden input type to be downloaded
 */
function addProgramsToDownload() {
    $("#program").remove();
    $(".tab-pane").each(function (index, element) {
        let id = $(this).find(".ace").attr("id");
        let value = editors[id].getValue();
        $(".layout").prepend(
            $("<input>", {
                type: "hidden",
                name: `program[${index}]`,
                id: `program${index}`,
                value: `${value}`,
                class: "programs",
            })
        );
    });
}
/**
 * Destroy all th hidden input type created and insert the default input type
 */
function destroyPrograms() {
    $(".programs").each(function (index) {
        $(this).remove();
    });
    $(".layout").prepend(
        $("<input>", {
            type: "hidden",
            name: "program[0]",
            id: `program`,
            value: " ",
            class: "programs",
        })
    );
}

/**
 * Generate unique id for the new tab and for the editor
 * @returns {number}
 */
function generateID() {
    let id = $(".nav-tabs").children().length;

    while ($(`#tab${id}`).length !== 0 && $(`#editor${id}`).length !== 0) {
        id += 1;
    }
    return id;
}

/**
 * Sets the theme to all the editors
 * @param {string} theme - value of the theme chosen
 */
function setEditorTheme(theme) {
    for (const editor in editors) {
        editors[editor].setTheme(theme);
    }
}

/**
 * Sets the font's size to all the editors
 * @param {number} size - font's size
 */
function setFontSizeEditors(size) {
    for (const editor in editors) {
        editors[editor].setFontSize(size + "px");
    }
}

/**
 * Checks if the browser supports the localStorage
 * @returns {boolean}
 */
function supportLocalStorage() {
    try {
        return "localStorage" in window && window["localStorage"] !== null;
    } catch (e) {
        return false;
    }
}

/**
 * Saves options in localStorage
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function saveOption(key, value) {
    if (!supportLocalStorage) {
        return false;
    }
    localStorage[key] = value;
    return true;
}

/**
 * Restore the saved output pane layout data from the localStorage
 */
function restoreOutputPaneLayout() {
    if (!supportLocalStorage) {
        return false;
    }

    let layoutPos = localStorage.getItem("outputPos");
    layoutPos = layoutPos !== null ? layoutPos : "east";
    if (layoutPos === "east") {
        addEastLayout(layout);
    } else {
        addSouthLayout(layout);
    }
    return true;
}

/**
 * Remove all the current options and add the new options from the project configuration
 * @param {Object} config - project configuration object
 */
function setOptions(config) {
    $("#solver-options").empty();
    $(config.option).each(function (index, item) {
        // create option's form
        if (item !== null) {
            addOption(item);
        }
    });
}

/**
 * Create and returns the tab pill jQuery element
 * @param {string} tabId - ID of the new tab
 * @param {string} tabName - tab name to put
 * @returns {jQuery}
 */
function getTabPillElement(tabId, tabName) {
    let $li = $("<li>", { class: "nav-item" });
    let $aBtnTab = $("<a>", {
        class: "btn-tab nav-link",
        role: "tab",
        "data-toggle": "tab",
        "data-target": `#${tabId}`,
    });

    $aBtnTab.append(
        $("<button>", {
            type: "button",
            class: "btn btn-light btn-sm btn-context-tab mr-1",
        }).append(
            $("<i>", { class: "fa fa-ellipsis-v", "aria-hidden": "true" })
        )
    );
    $aBtnTab.append(
        $("<span>", { class: "name-tab unselectable mr-1" }).text(tabName)
    );
    $aBtnTab.append(
        $("<span>", { class: "delete-tab" }).append(
            $("<i>", { class: "fa fa-times", "aria-hidden": "true" })
        )
    );

    $li.append($aBtnTab);

    return $li;
}

/**
 * Create and returns the tab content jQuery element
 * @param tabId - ID of the new tab
 * @param editorId - ID of the new editor
 * @returns {jQuery}
 */
function getTabContentElement(tabId, editorId) {
    let $tabContent = $("<div>", {
        role: "tabpanel",
        class: "tab-pane fade",
        id: tabId,
    }).append($("<div>", { id: editorId, class: "ace" }));

    return $tabContent;
}

/**
 * Create and returns the button element of the tab to execute
 * @param tabId - ID of the new tab
 * @param editorId - ID of the new editor
 */
function getTabButtonToExecuteElement(editorId, tabName) {
    let $button = $("<button>", {
        type: "button",
        class: "list-group-item list-group-item-action check-run-tab",
        value: editorId,
    });

    $button.append(
        $("<div>", { class: "check-box" }).append(
            $("<i>", {
                class: "fa fa-check check-icon invisible",
                "aria-hidden": "true",
            })
        )
    );

    $button.append($("<span>", { class: "check-tab-name" }).text(tabName));

    return $button;
}

/**
 * Create and Adds new editor tab
 * @param {string} text - set value of the new editor tab
 * @param {string} name - set name of the new editor tab
 * @returns {string} new editor ID
 */
function addEditorTab(text, name) {
    let newID = generateID();
    let tabId = "tab" + newID;
    let editorId = "editor" + newID;
    let tabName = name == null ? "L P " + newID : name;

    let $tabPill = getTabPillElement(tabId, tabName);
    let $tabContent = getTabContentElement(tabId, editorId);
    let $buttonTabToExecute = getTabButtonToExecuteElement(editorId, tabName);

    $($tabPill).insertBefore($(".add-tab").parent());
    $(".tab-content").append($tabContent);

    setUpAce(editorId, text);

    $("#tab-execute-content").append($buttonTabToExecute);

    initializeTabContextmenu();
    initializeCheckTabToRun();
    setAceMode();
    setElementsColorMode();

    let currentFontSize = $("#font-editor-range").val();
    editors[editorId].setFontSize(currentFontSize + "px");

    return tabId;
}

/**
 * Reset Appearance settings with default values
 */
function resetAppearanceSettings() {
    $("#theme").val(defaultTheme);
    saveOption("theme", defaultTheme);
    setEditorTheme(defaultTheme);
    $("#font-editor-range").val(defaultFontSize).change();
    $("#font-output-range").val(defaultFontSize).change();
    setLoideStyleMode("light");
}

/**
 * Reset run settings with default values
 */
function resetRunSettings() {
    loadLanguages();
    $("#run-dot").prop("checked", true);
    $(".check-auto-run-tab").trigger("click");
    $("#solver-options").empty();
}

/**
 * Close all the opened popovers
 * @param {string} iam
 */
function closeAllPopovers(iam) {
    // close contestmenu popovers
    $(".btn-tab").popover("hide");
    if (iam != popoverType.SAVE) $(".popover-download").popover("hide");
    if (iam != popoverType.SHARE) $(".popover-share").popover("hide");
}

/**
 * Create and returns the jQuery element of the save popover body
 * @returns {jQuery}
 */
function getSavePopoverBodyElement() {
    let $popoverBody = $("<div>", { class: "save-content" });

    $popoverBody.append($("<h6>", { class: "mb-2" }).text("Save the project"));

    let $inputText = $("<input>", {
        type: "text",
        class: "form-control mb-2",
        id: "project-name-textbox",
        placeholder: "Type a name",
        value: projectName,
    });

    $popoverBody.append($inputText);

    $popoverBody.append(
        $("<div>", { class: "save-btn text-center" }).append(
            $("<button>", {
                id: "local-download",
                class: "btn btn-outline-dark btn-saver btn-block",
            }).text("Save")
        )
    );

    return $popoverBody;
}

/**
 * Create and returns the jQuery element of the share popover body
 * @returns {jQuery}
 */
function getSharePopoverBodyElement() {
    let $popoverBody = $("<div>", { class: "popover-share-content" });
    $popoverBody.append(
        $("<h6>", { class: "mb-2" }).text("Share the project:")
    );

    let $inputGroup = $("<div>", { class: "input-group" });
    $inputGroup.append(
        $("<input>", {
            id: "link-to-share",
            type: "text",
            class: "form-control",
            readonly: "",
        })
    );
    $inputGroup.append(
        $("<div>", { class: "input-group-append" }).append(
            $("<button>", {
                id: "btn-copy-link",
                class: "btn btn-light",
                type: "button",
                "data-clipboard-target": "#link-to-share",
            }).append(
                $("<i>", {
                    class: "fa fa-clipboard",
                    "aria-hidden": "true",
                })
            )
        )
    );

    $popoverBody.append($inputGroup);

    return $popoverBody;
}

/**
 * @global
 * Popover type
 */
const popoverType = {
    SAVE: "save",
    SHARE: "share",
};

/**
 * Initialize the Save and Share popover
 */
function initializePopovers() {
    // Prevent to not close the popover when the user clicks inside of the popover
    $("body").on("mousedown", ".popover", function (e) {
        e.stopPropagation();
    });

    $("body").on("mousedown", function (e) {
        closeAllPopovers();
    });

    $(".popover-download")
        .popover({
            html: true,
            placement: "bottom",
            trigger: "manual",
        })
        .on("mousedown", function (e) {
            closeAllPopovers(popoverType.SAVE);
            $(this).popover("toggle");
            e.stopPropagation();
            e.preventDefault();
        });

    $(".popover-download").on("inserted.bs.popover", function () {
        // set what happens when user clicks on the button
        $(".popover-header").last().empty();

        let $popoverBody = getSavePopoverBodyElement();

        $(".popover-body").last().append($popoverBody);

        // focus the input text box
        $("#project-name-textbox").focus();

        if (localStorage.getItem("mode") === "dark") {
            $("#local-download").removeClass("btn-outline-dark");
            $("#local-download").addClass("btn-outline-light");
        } else {
            $("#local-download").removeClass("btn-outline-light");
            $("#local-download").addClass("btn-outline-dark");
        }

        $("#local-download").on("click", function () {
            let inputProjectName = $("#project-name-textbox").val();
            if (inputProjectName.length > 0) projectName = inputProjectName; // Update the project name
            downloadLoDIEProject(inputProjectName);
        });
    });

    $(".popover-download").on("hidden.bs.popover", function () {
        // clear listeners
        $("#local-download").off("click");
        // $("#cloud-download").off("click");
        $(".navbar-toggler").off("click");
    });

    $(".popover-share")
        .popover({
            container: "body",
            html: true,
            placement: "bottom",
            trigger: "manual",
        })
        .on("mousedown", function (e) {
            closeAllPopovers(popoverType.SHARE);
            $(this).popover("toggle");
            e.stopPropagation();
            e.preventDefault();
        });

    $(".popover-share").on("inserted.bs.popover", function () {
        $(".popover-header").last().empty();

        let $popoverBody = getSharePopoverBodyElement();

        $(".popover-body").last().html($popoverBody);

        if (localStorage.getItem("mode") === "dark") {
            $("#btn-copy-link").removeClass("btn-light");
            $("#btn-copy-link").addClass("btn-dark");
        } else {
            $("#btn-copy-link").removeClass("btn-dark");
            $("#btn-copy-link").addClass("btn-light");
        }

        $("#link-to-share").val("Loading...");
        createURL();
    });

    $(".popover-share").on("hidden.bs.popover", function () {
        $("#btn-copy-link").off("click");
    });
}

/**
 * Initialize the toolbar buttons
 */
function initializeToolbar() {
    // Add new editor tab
    $(document).on("click", ".add-tab", function () {
        let tabID = addEditorTab("");
        $("[data-target='#" + tabID + "']").tab("show"); //active last tab inserted

        let actualTheme =
            localStorage.getItem("theme") == null
                ? ""
                : localStorage.getItem("theme");
        if (actualTheme.length == 0) {
            if (localStorage.getItem("mode") === "dark")
                setEditorTheme(defaultDarkTheme);
            else {
                setEditorTheme(defaultTheme);
            }
        } else {
            setEditorTheme(actualTheme);
        }
    });

    $("#btn-undo").on("click", function () {
        let undoManager = editors[idEditor].session.getUndoManager();
        if (undoManager.hasUndo()) {
            undoManager.undo();
        }
    });

    $("#btn-redo").on("click", function () {
        let undoManager = editors[idEditor].session.getUndoManager();
        if (undoManager.hasRedo()) {
            undoManager.redo();
        }
    });

    $("#btn-search").on("click", function () {
        let searchPanel = $("#" + idEditor).find(".ace_search");

        if (searchPanel.length == 0) {
            editors[idEditor].execCommand("find");
        } else {
            if (searchPanel.css("display") == "none") {
                searchPanel.css("display", "block");
            } else {
                searchPanel.css("display", "none");
            }
        }
    });

    $("#btn-copy").on("click", function () {
        copyStringToClipboard(editors[idEditor].getCopyText());
        editors[idEditor].focus();
    });

    $("#btn-cut").on("click", function () {
        copyStringToClipboard(editors[idEditor].getCopyText());
        editors[idEditor].execCommand("cut");
        editors[idEditor].focus();
    });

    let clipboardSupport = false;

    try {
        clipboardSupport =
            typeof navigator.clipboard.readText == "undefined" ? false : true;
    } catch (error) {
        console.error("Clipboard is not supported in this browser");
        clipboardSupport = false;
    }

    if (clipboardSupport) {
        $("#btn-paste").on("click", function () {
            navigator.clipboard
                .readText()
                .then((text) => {
                    editors[idEditor].insert(text);
                })
                .catch((err) => {
                    // maybe user didn't grant access to read from clipboard
                    operation_alert({
                        reason:
                            "Clipboard read error, maybe you didn't grant the access to read from the clipboard.",
                    });
                    console.error(err);
                });
        });
    } else {
        console.error("Clipboard API is not supported in this browser");
        $("#btn-paste").remove();
    }

    $("#btn-dwn-this-lp").on("click", function () {
        downloadCurrentTabContent();
    });

    $("#delete-all-tabs").on("click", function () {
        deleteAllTabs();
    });
}

/**
 * Create a confirmation alert and delete all the editor tabs if the user confirms
 */
function deleteAllTabs() {
    let deleteAlertConfirm = confirm(
        "Are you sure you want to delete all tabs? This cannot be undone."
    );
    if (deleteAlertConfirm) {
        $(".delete-tab").each(function () {
            deleteTab($(this), true);
        });
    }
}

/**
 * Create a confirmation alert and delete the editor tab if the user confirms
 * @param {jQuery} deleteTabButton - delete tab button of the tab to delete
 * @param {boolean} skipConfirm - indicate if need to show the confirmation alert
 */
function deleteTab(deleteTabButton, skipConfirm) {
    let deleteAlertConfirm;
    if (!skipConfirm) {
        deleteAlertConfirm = confirm(
            "Are you sure you want to delete this file? This cannot be undone."
        );
    }
    if (deleteAlertConfirm || skipConfirm) {
        let prevEditor = deleteTabButton.parent().parent().prev();
        if (prevEditor.length === 0) {
            prevEditor = deleteTabButton.parent().parent().next();
        }
        let currentID = deleteTabButton.closest("a").attr("data-target");
        deleteTabButton.parent().parent().remove(); // delete the li element
        let ideditor = $(currentID).find(".ace").attr("id");
        $(currentID).remove(); // remove the tabpanel containing the editor
        delete editors[ideditor]; // remove the editor from the array
        $(
            "[data-target='" + prevEditor.find("a").attr("data-target") + "']"
        ).tab("show");
        $('.check-run-tab[value="' + ideditor + '"]').remove(); // delete the tab on the tab to execute list
        if ($(".nav-tabs").children().length === 1) {
            // add a new tab if the user deletes the last

            let parent = $(".add-tab").parent();

            let newTabID = "tab1";
            let newTabName = "L P 1";

            let $newTabPill = getTabPillElement(newTabID, newTabName);
            $($newTabPill).insertBefore(parent);

            let $newTabContent = getTabContentElement(newTabID, idEditor);
            $(".tab-content").append($newTabContent);

            editors[idEditor] = new ace.edit(idEditor);
            setUpAce(idEditor, "");

            let $newButtonTabToExecute = getTabButtonToExecuteElement(
                idEditor,
                newTabName
            );
            $("#tab-execute-content").append($newButtonTabToExecute);

            // Select and active the first tab
            $("#editor-tabs li:first-child a").tab("show");
        }

        initializeTabContextmenu();
        initializeCheckTabToRun();
        setAceMode();
        setElementsColorMode();
    }
}

/**
 * Download the current tab in a text file
 */
function downloadCurrentTabContent() {
    let text = editors[idEditor].getValue();
    let TabToDownload = $("#" + idEditor)
        .parent()
        .attr("id");
    let nameTab = $(".btn-tab[data-target='#" + TabToDownload + "']");
    let string = nameTab.text().replace(/\s/g, "");
    createFileToDownload(text, "local", "LogicProgram_" + string, "txt");
}

/**
 * Run the logic program of the current tab
 */
function runCurrentTab() {
    $("#output-model").empty();
    $("#output-error").empty();
    $("#output-model").text("Sending..");
    callSocketServer(true);
}

/**
 * Load the snippets in the ACE editor
 */
function initializeSnippets() {
    let languageChosen = $("#inputLanguage").val();
    let solverChosen = $("#inputengine").val();

    let langTools = ace.require("ace/ext/language_tools");

    langTools.setCompleters([]); // reset completers.

    // completer that include snippets and some keywords
    let completer;

    switch (languageChosen) {
        case "datalog":
            switch (solverChosen) {
                case "idlv":
                    completer = {
                        identifierRegexps: [
                            /[a-zA-Z_0-9\#\:\$\-\u00A2-\uFFFF]/,
                        ],
                        getCompletions: function (
                            editor,
                            session,
                            pos,
                            prefix,
                            callback
                        ) {
                            var completions = [
                                {
                                    caption: ":-",
                                    snippet: ":- ${1:literals}.",
                                    meta: "body/constraint",
                                },
                            ];
                            callback(null, completions);
                        },
                    };
                    langTools.addCompleter(completer);
                    break;
            }
        case "asp":
            switch (solverChosen) {
                case "dlv":
                    completer = {
                        identifierRegexps: [
                            /[a-zA-Z_0-9\#\:\$\-\u00A2-\uFFFF]/,
                        ],
                        getCompletions: function (
                            editor,
                            session,
                            pos,
                            prefix,
                            callback
                        ) {
                            let completions = [
                                {
                                    caption: "#const",
                                    snippet:
                                        "#const ${1:namedConstant} = ${2:costant}",
                                    meta: "keyword",
                                },
                                {
                                    caption: "#maxint",
                                    snippet: "#maxint = ${1:Number}",
                                    meta: "keyword",
                                },
                                {
                                    caption: "#append",
                                    snippet: "#append(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#delnth",
                                    snippet: "#delnth(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#flatten",
                                    snippet: "#flatten(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#head",
                                    snippet: "#head(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#insLast",
                                    snippet: "#insLast(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#insnth",
                                    snippet:
                                        "#insnth(${1:X}, ${2:Y}, ${3:Z}, ${4:W})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#last",
                                    snippet: "#last(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#length",
                                    snippet: "#length(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#member",
                                    snippet: "#member(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#reverse",
                                    snippet: "#reverse(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#subList",
                                    snippet: "#subList(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#tail",
                                    snippet: "#tail(${1:X}, ${2:Y})",
                                    meta: "list predicate",
                                },
                                {
                                    caption: "#getnth",
                                    snippet: "#getnth(${1:X}, ${2:Y}, ${3:Z})",
                                    meta: "list predicate",
                                },

                                // -------
                                {
                                    caption: "+",
                                    snippet:
                                        "+(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "-",
                                    snippet:
                                        "-(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "*",
                                    snippet:
                                        "*(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "/",
                                    snippet:
                                        "/(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                // {
                                //     caption: "#int(X)",
                                //     snippet: "#int(${1:Var})",
                                //     meta: "arithmetic predicates"
                                // },
                                {
                                    caption: "#int",
                                    snippet:
                                        "#int(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "#suc",
                                    snippet: "#suc(${1:Var1}, ${2:Var2})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "#pred",
                                    snippet: "#pred(${1:Var1}, ${2:Var2})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "#mod",
                                    snippet:
                                        "#mod(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "#absdiff",
                                    snippet:
                                        "#absdiff(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                {
                                    caption: "#rand",
                                    snippet:
                                        "#rand(${1:Var1}, ${2:Var2}, ${3:Var3})",
                                    meta: "arithmetic predicates",
                                },
                                // {
                                //     caption: "#rand(X)",
                                //     snippet: "#rand(${1:Var})",
                                //     meta: "arithmetic predicates"
                                // },
                                {
                                    caption: "#times",
                                    snippet: "#times{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#sum",
                                    snippet: "#sum{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#min",
                                    snippet: "#min{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#max",
                                    snippet: "#max{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#count",
                                    snippet: "#count{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: ":~",
                                    snippet:
                                        ":~ ${1:literals}. [${2:conditions}]",
                                    meta: "weak constraint",
                                },
                                {
                                    caption: ":-",
                                    snippet: ":- ${1:literals}.",
                                    meta: "body/constraint",
                                },
                            ];
                            callback(null, completions);
                        },
                    };
                    langTools.addCompleter(completer);
                    break;

                case "dlv2":
                    completer = {
                        identifierRegexps: [
                            /[a-zA-Z_0-9\#\:\$\-\u00A2-\uFFFF]/,
                        ],
                        getCompletions: function (
                            editor,
                            session,
                            pos,
                            prefix,
                            callback
                        ) {
                            let completions = [
                                {
                                    caption: "#int",
                                    snippet: "#int",
                                    meta: "keyword",
                                },
                                {
                                    caption: "#times",
                                    snippet: "#times{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#sum",
                                    snippet: "#sum{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#min",
                                    snippet: "#min{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#max",
                                    snippet: "#max{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: "#count",
                                    snippet: "#count{${1:Vars} : ${2:Congj}}",
                                    meta: "aggregate function",
                                },
                                {
                                    caption: ":~",
                                    snippet:
                                        ":~ ${1:literals}. [${2:conditions}]",
                                    meta: "weak constraint",
                                },
                                {
                                    caption: ":-",
                                    snippet: ":- ${1:literals}.",
                                    meta: "body/constraint",
                                },
                            ];
                            callback(null, completions);
                        },
                    };
                    langTools.addCompleter(completer);
                    break;
                case "clingo":
                // add snippets
            }
            break;

        default:
            break;
    }
}

/**
 * Find the compatible words in the content editor and put them in the snippets of the ACE editor
 */
function initializeAutoComplete() {
    let languageChosen = $("#inputLanguage").val();
    let langTools = ace.require("ace/ext/language_tools");
    initializeSnippets();
    switch (languageChosen) {
        case "asp":
        case "datalog": {
            let splitRegex = /(([a-zA-Z_]+[0-9]*)*)(\(.+?\))/gi;
            let words = editors[idEditor].getValue().match(splitRegex);
            if (words != null) {
                let map = new Map();
                words.forEach(function (word) {
                    let name = word.match(/[^_](([a-zA-Z_]+[0-9]*)*)/)[0];
                    let arities = word.match(/\(.+?\)/)[0].split(",").length;
                    map.set(name, arities);
                });
                let completions = [];
                map.forEach(function (value, key) {
                    completions.push({
                        caption: key,
                        snippet: key + giveBrackets(value),
                        meta: "atom",
                    });
                });

                let completer = {
                    getCompletions: function (
                        editor,
                        session,
                        pos,
                        prefix,
                        callback
                    ) {
                        callback(null, completions);
                    },
                };

                langTools.addCompleter(completer);
            }
            break;
        }
        default:
            break;
    }
}

/**
 * Return the arities of the atom in TextMate format
 * @param value - arities of the atom
 * @returns {string}
 * @example atom(1,2) -> value is 2, then the function return (${1:A},${2:B})
 */
function giveBrackets(value) {
    let par = "(";
    let LETTER = "A";
    let limit = 0;
    if (value <= 26) limit = value;
    else limit = 26;
    for (let i = 0; i < limit; i++) {
        let num = i + 1;
        par += "${" + num + ":" + LETTER + "}";
        if (i !== limit - 1) {
            par += ",";
        }
        LETTER = String.fromCharCode(LETTER.charCodeAt(0) + 1);
    }
    par += ")";
    return par;
}

/**
 * Create the URL that contains params about the loide project and
 * call the "is.gd" API to get the short version of the URL.
 * Then put the URL into the share popover.
 */
function createURL() {
    let URL = window.location.host + "/?project=";
    let project = createLoideProjectConfig();
    let empty = true;

    for (let i = 0; i < project.program.length; i++) {
        if (project.program[i].trim().length > 0) {
            empty = false;
            break;
        }
    }

    // If the are only empties editor tabs shows only the window.location.href
    if (empty) {
        $("#link-to-share").val(window.location.href);
    } else {
        let param = encodeURIComponent(JSON.stringify(project));
        URL += param;

        try {
            $.ajax({
                method: "POST",
                url:
                    "https://is.gd/create.php?format=json&url=" +
                    encodeURIComponent(URL),
                dataType: "json",
                crossDomain: true,
                success: function (data) {
                    if (data.shorturl == undefined) {
                        console.error(data);
                        $("#link-to-share").val("Ops. Something went wrong");
                        if (URL.length >= 5000) {
                            operation_alert({
                                reason:
                                    "The logic program is too long to be shared.",
                            });
                        }
                    } else {
                        $("#link-to-share").val(data.shorturl);
                        $("#btn-copy-link").prop("disabled", false);
                    }
                },
                error: function (err) {
                    console.error(err);
                    $("#link-to-share").val("Ops. Something went wrong");
                },
            });
        } catch (e) {
            $("#link-to-share").val("Ops. Something went wrong");
        }
    }
}

/**
 * Get the param value of a param in a URL
 * @param {string} name - name of the param to get the value
 * @param {string} url - URL where to find the param
 * @returns {(string | null)}
 */
function getParameterByName(name, url) {
    let searchParam = new URLSearchParams(new URL(url).search);

    if (searchParam.has(name)) {
        let value = searchParam.get(name);
        return value;
    }

    return null;
}

/**
 * Check if there is a project on the current URL and load it
 */
function loadFromURL() {
    let thisURL = window.location.href;
    let projectParam = null;
    try {
        projectParam = getParameterByName("project", thisURL);
    } catch (error) {
        operation_alert({ reason: "Cannot load the project from the URL." });
    }
    if (projectParam != null) {
        let projectjson = decodeURIComponent(projectParam);
        if (projectjson != undefined && isJSON(projectjson)) {
            let project = JSON.parse(projectjson);
            if (!setJSONInput(project)) {
                operation_alert({
                    reason: "Error load the project from the URL",
                });
            } else {
                initializeTabContextmenu();
                operation_alert({
                    reason: "Project loaded successfully from the URL",
                });
            }
        }
    }
}

/**
 * Set a tooltip in a HTML element
 * @param {HTMLElement} element - HTML element where set a tooltip
 * @param {string} message - Tooltip message
 */
function setTooltip(element, message) {
    $(element)
        .tooltip("hide")
        .attr("data-original-title", message)
        .tooltip("show");
}

/**
 * Hide the tooltip in a HTML element
 * @param {HTMLElement} element - Button where set a tooltip
 * @param {string} message - Tooltip message
 */
function hideTooltip(element) {
    setTimeout(function () {
        $(element).tooltip("hide");
    }, 1000);
}

/**
 * Set ClipboardJS plugin in the input text of share popover
 */
function setClipboard() {
    $("#btn-copy-link").tooltip({
        trigger: "click",
        placement: "bottom",
    });

    let clipboard = new ClipboardJS("#btn-copy-link");

    clipboard.on("success", function (e) {
        setTooltip(e.trigger, "Copied!");
        hideTooltip(e.trigger);
    });

    clipboard.on("error", function (e) {
        setTooltip(e.trigger, "Failed!");
        hideTooltip(e.trigger);
    });
}

/**
 * Initialize the toast notifications
 */
function initializeToastNotifications() {
    $("#notification").toast({
        delay: 4000,
    });
    $("#notification-project").toast({
        delay: 10000,
    });
    $("#load-project").on("click", function () {
        loadProjectFromLocalStorage();
        $("#notification-project").toast("hide");
    });
}

/**
 * Add window resize trigger events when the user open or close the open file section
 */
function setWindowResizeTrigger() {
    $("#loide-collapse").on("hidden.bs.collapse", function () {
        $(window).trigger("resize");
    });
    $("#loide-collapse").on("shown.bs.collapse", function () {
        $(window).trigger("resize");
    });
}

/**
 * Set or remove the 'dark' class in body related on the mode value
 * @param {string} mode - mode value
 */
function setLoideStyleMode(mode) {
    switch (mode) {
        case "light":
            localStorage.setItem("mode", "light");
            document.querySelector("body").classList.remove("dark");
            break;

        case "dark":
            localStorage.setItem("mode", "dark");
            document.querySelector("body").classList.add("dark");
            break;

        default:
            if (localStorage.getItem("mode") == null)
                localStorage.setItem("mode", "light");
            (localStorage.getItem("mode") || "dark") === "dark"
                ? document.querySelector("body").classList.add("dark")
                : document.querySelector("body").classList.remove("dark");
            break;
    }
    setElementsColorMode();
}

/**
 * Change the HTML element color style based on the LoIDE mode
 */
function setElementsColorMode() {
    switch (localStorage.getItem("mode")) {
        case "light":
            setLightStyleToUIElements();
            break;

        case "dark":
            setDarkStyleToUIElements();
            break;

        default:
            setLightStyleToUIElements();
            break;
    }
}

/**
 * Change the HTML element color style in the light mode
 */
function setLightStyleToUIElements() {
    $("#dark-light-mode").text("Dark");
    $(".btn-dark").each(function () {
        $(this).removeClass("btn-dark");
        $(this).addClass("btn-light");
    });
    $(".btn-outline-light").each(function () {
        $(this).addClass("btn-outline-dark");
        $(this).removeClass("btn-outline-light");
    });
    $("#dark-light-mode").addClass("btn-outline-dark");
    $("#dark-light-mode").removeClass("btn-outline-light");

    let actualTheme = $("#theme").val();
    if (actualTheme == defaultDarkTheme) $("#theme").val(defaultTheme).change();
}

/**
 * Change the HTML element color style in the dark mode
 */
function setDarkStyleToUIElements() {
    $("#dark-light-mode").text("Light");
    $(".btn-light").each(function () {
        $(this).removeClass("btn-light");
        $(this).addClass("btn-dark");
    });
    $(".btn-outline-dark").each(function () {
        $(this).removeClass("btn-outline-dark");
        $(this).addClass("btn-outline-light");
    });
    $("#dark-light-mode").removeClass("btn-outline-dark");
    $("#dark-light-mode").addClass("btn-outline-light");

    let actualTheme = $("#theme").val();
    if (actualTheme == defaultTheme) $("#theme").val(defaultDarkTheme).change();
}

/**
 * Create the project object and save it in the localStorage
 */
function saveProjectToLocalStorage() {
    let project = createLoideProjectConfig();
    saveOption("loideProject", JSON.stringify(project));
}

/**
 * Check if there is a project object saved in the localStorage,
 * if there is LoIDE will show a toast notification if the user want to restore it
 */
function checkProjectOnLocalStorage() {
    if (supportLocalStorage()) {
        let projectjson = localStorage.getItem("loideProject");
        if (projectjson != undefined && isJSON(projectjson)) {
            let project = JSON.parse(projectjson);
            if ({}.hasOwnProperty.call(project, "program")) {
                if (
                    project.program.length > 1 ||
                    project.program[0].trim().length > 0
                ) {
                    $("#notification-project").toast("show");
                }
            }
        }
    }
}

/**
 * Take the project object from the localStorage and restore it
 */
function loadProjectFromLocalStorage() {
    if (supportLocalStorage()) {
        let projectjson = localStorage.getItem("loideProject");
        if (isJSON(projectjson)) {
            let project = JSON.parse(projectjson);
            if (!setJSONInput(project)) {
                operation_alert({ reason: "Error load the project" });
            }
            initializeTabContextmenu();
        }
    }
}

/**
 * Create HTML hidden elements for each tab with the value of the tab name
 */
function addTabsNameToDownload() {
    $(".name-tab").each(function (index) {
        let $input = $("<input>", {
            type: "hidden",
            name: `tabname[${index}]`,
            id: `tabname${index}`,
            value: $(this).text(),
            class: "tabsname",
        });
        $(".layout").prepend($input);
    });
}

/**
 * Destroy the HTML hidden elements that contains the value of the tab name
 */
function destroyTabsName() {
    $(".tabsname").each(function (index) {
        $(this).remove();
    });
}

/**
 * Set the tab names from the project configuration
 * @param {Object} config - project configuration
 */
function setTabsName(config) {
    let tabsName = config.tabname;
    $(".name-tab").each(function (index) {
        $(this).text(tabsName[index]);
        let id = index + 1;
        let editor = "editor" + id;
        $('.check-run-tab[value="' + editor + '"]')
            .find(".check-tab-name")
            .text(tabsName[index]);
    });
}

/**
 * Create the project configuration
 * @returns {Object} - project configuration
 */
function createLoideProjectConfig() {
    addProgramsToDownload();
    addTabsNameToDownload();

    let model = $("#output-model").text();
    let errors = $("#output-error").text();

    $("#run-dot").attr("name", "runAuto");

    let form = $("#input").serializeFormJSON();

    form.output_model = model;
    form.output_error = errors;
    form.tab = [];

    $(".check-run-tab.checked").each(function (index, element) {
        form.tab.push($(this).val());
    });

    if (form.tab.length == 0) {
        delete form.tab;
    }

    destroyPrograms();
    destroyTabsName();
    $("#run-dot").removeAttr("name");

    return form;
}

/**
 * Create and download in a text file of the project configuration converted in JSON format
 * @param name - name of the project file
 */
function downloadLoDIEProject(name) {
    let project = createLoideProjectConfig();
    let stringify = JSON.stringify(project);
    let fileName =
        name == undefined || typeof name !== "string" || name.length === 0
            ? projectName
            : name;
    createFileToDownload(stringify, "local", fileName, "json");
}

/**
 * Remunerate all the solver option titles
 */
function remunerateSelectOptionsAndBadge() {
    $(".form-control-option").each(function (index) {
        $(this).attr("name", "option[" + index + "][name]");
        $(this)
            .closest(".row-option")
            .find(".form-control-value")
            .each(function (index2) {
                $(this).attr("name", "option[" + index + "][value][]");
            });
    });

    $(".option-number").each(function (index) {
        let i = index + 1;
        $(this).text("Option " + i);
    });
}

/**
 * Close the run settings pane on mobile
 */
function closeRunSettingsOnMobile() {
    if ($(window).width() <= display.small.size) {
        toggleRunSettings();
    }
}

/**
 * Toggle the run settings pane
 */
function toggleRunSettings() {
    $(".left-panel").toggleClass("left-panel-show"); // add class 'left-panel-show' to increase the width of the left panel
    $(".left-panel").toggleClass("mr-1");

    $(".left-panel-show, .left-panel").one(
        "transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd",
        function () {
            resizeAllEditorsAndLayout();
        }
    );
}

/**
 * Get the HTML element string format from a jQuery element
 * @param {jQuery} jQueryElement
 * @returns {strings} - HTML element string format
 */
function getHTMLFromJQueryElement(jQueryElement) {
    let DOMElement = "";
    for (let i = 0; i < jQueryElement.length; i++)
        DOMElement += jQueryElement.get(i).outerHTML;

    return DOMElement;
}

/**
 * Set the mode of the ACE editor from the input language select
 */
function setAceMode() {
    switch ($("#inputLanguage").val()) {
        case "asp": {
            for (const editor in editors) {
                editors[editor].session.setMode("ace/mode/asp");
            }
            break;
        }
        case "datalog": {
            for (const editor in editors) {
                editors[editor].session.setMode("ace/mode/datalog");
            }
            break;
        }
        default: {
            for (const editor in editors) {
                editors[editor].session.setMode("ace/mode/text");
            }
        }
    }
}

/**
 * Download the output content in a text file
 */
function downloadOutput() {
    let outputText =
        $("#output-model").text() + "\n" + $("#output-error").text();
    createFileToDownload(outputText, "local", "LoIDE_output", "txt");
}

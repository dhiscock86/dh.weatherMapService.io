/*
 * Title: require.js
 * Purpose: To create required module and trigger application events
 * Author: Daniel Hiscock
 * Date: July, 7, 2018
 * Disclaimer: This web application was created at the request of con*terra to exhibit
 *             web development skills.
 */
require([
    "js/define.js",
    "dojo/on",
    "dojo/dom",
    "dojo/parser",
    "dojo/domReady!"
], function (
        define,
        on,
        dom,
        parser) {

    parser.parse();
    
    // initialize the user interface
    define.initialize();
    
    // event handler for city layer toggle button
    var cityToggle = dom.byId("cityTgl");
    on(cityToggle, "click", define.toggleCities);

});




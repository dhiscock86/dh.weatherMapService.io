/*
 * Title: define.js
 * Purpose: To initialize the browser map interface, define modules,create widgets
 *          and send API requests for goecoding user selected weather information
 * Author: Daniel Hiscock
 * Date: July, 7, 2018
 * Disclaimer: This web application was created at the request of con*terra for to exhibit
 *             web development skills for recruitment.
 */
define([
    "esri/map",
    "esri/layers/FeatureLayer",
    "esri/InfoTemplate",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/geometry/webMercatorUtils",
    "esri/dijit/Scalebar",
    "esri/dijit/Legend",
    "esri/config",
    "esri/request",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/dom",
    "dojo/on",
    "dojo/parser",
    "dojo/_base/json",
    "dojo/domReady!"
], function (
        Map,
        FeatureLayer,
        InfoTemplate,
        SimpleMarkerSymbol,
        webMercatorUtils,
        Scalebar,
        Legend,
        esriConfig,
        esriRequest,
        arrayUtils,
        Color,
        dom,
        on,
        parser,
        dojoJson
        ) {
    
    parser.parse();
    
    // Callback function to require script
    return {
        initialize: initialize,
        toggleCities: toggleCities
    };
    
    // global variables
    const map, url, cities;
    
    //****************************************************************************************
    //Function to initialize map and esri widgets
    //****************************************************************************************
    function initialize() {

        map = new Map("map", {
            basemap: "gray-vector",
            center: [26, 55],
            zoom: 3,
            slider: true
        });

        var scalebar = new Scalebar({
            map: map,
            scalebarUnit: "metric"
        });     
        
        map.addLayer(loadCities());
        
        // create a legend for the city feature based on population
        var legend = new Legend({
          map: map,
          layerInfos: [{
            layer: cities,
            title: "City Population"
          }]
        }, "legendDiv");
        
        // display coordinates based on click
        map.on("click", showCoordinates);
    }
    
    //****************************************************************************************
    // load the cities feature layer function, apply rendering and infotemplate
    //****************************************************************************************
    function loadCities() {
        // infotemplate - not a required component
        const template = new InfoTemplate("${CITY_NAME}", "Population: ${POP}");

        url = "https://services1.arcgis.com/XRQ58kpEa17kSlHX/ArcGIS/rest/services/World_Cities/FeatureServer/0";
        
        cities = new FeatureLayer(url, {
            mode: FeatureLayer.MODE_SNAPSHOT,
            orderByFields: ["POP DESC"],
            outFields: ["CITY_NAME", "POP"],
            opacity: 0.5,
            infoTemplate: template
        });
        
        // required data for proportional symbols based on city population
        var sizeInfo = {
            field: "POP",
            valueUnit: "unknown",
            minDataValue: 50000,
            maxDataValue: 1500000,
            minSize: 6,
            maxSize: 25
        };
        
        var marker = new SimpleMarkerSymbol();
        marker.setColor(new Color("#00FFFF"));
        marker.setStyle(SimpleMarkerSymbol.STYLE_CIRCLE);
        const renderer = new esri.renderer.SimpleRenderer(marker);
        cities.setRenderer(renderer);
        
        cities.on("load", function () {
            cities.renderer.setSizeInfo(sizeInfo);
        });

        return cities;
    }
    //****************************************************************************************
    // retrieve an display DD coordinates to display in HTML and use for reverse geocoding
    //****************************************************************************************
    function showCoordinates(evt) {
        const mp = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);
        //display mouse coordinates
        dom.byId("latitude").innerHTML = mp.y.toFixed(3);
        dom.byId("longitude").innerHTML = mp.x.toFixed(3);
        dom.byId("degrees1").innerHTML = "9&#176";
        dom.byId("degrees2").innerHTML = "9&#176";
        getPlace();
    }
    
    //****************************************************************************************
    // Enable access to the location API for reverse geocoding (CORS enabled)
    //****************************************************************************************
    function getPlace() {
        // Use CORS
        esriConfig.defaults.io.corsEnabledServers.push("https://api.opencagedata.com");
        const latitude = dom.byId("latitude").innerHTML;
        const longitude = dom.byId("longitude").innerHTML;

        const opendataApi = "https://api.opencagedata.com/geocode/v1/geojson?q=" + latitude + "+" 
                          + longitude + "&min_confidence=1&key=ac6c34cf21764d31b9d3ef6aa4a0047d";
        
        const placeRequest = esriRequest({
            "url": opendataApi
        });
        placeRequest.then(placeRequestSucceeded, requestFailed);
    }
    
    //****************************************************************************************
    // If request succeeds, pull in data location info from JSON
    //****************************************************************************************
    function placeRequestSucceeded(response) {

        var jsonstring = dojoJson.toJson(response, true);
        const json = JSON.parse(jsonstring);

        if (json) {
            const city = json.features[0].properties.components.city;
            const country = json.features[0].properties.components.country;
            const ccode = json.features[0].properties.components.country_code;

            dom.byId("jsonplace").innerHTML = city + ", " + country;
            dom.byId("jsonweather").innerHTML = city + ", " + country;

            getWeather(city, ccode);
        }
    }
    
    //****************************************************************************************
    // Results from location are used to forward geocode to retrieve weather information
    //****************************************************************************************
    function getWeather(city, ccode) {
        // Use CORS
        esriConfig.defaults.io.corsEnabledServers.push("https://api.openweathermap.org");
        const weatherAPI = "https://api.openweathermap.org/data/2.5/forecast?q=" + city + "," + ccode 
                       + "&lang=de&APPID=6b904086651c872d0e2c58c1529d2dcb";
        const weatherRequest = esriRequest({
            "url": weatherAPI
        });
        
        console.log(weatherRequest);
        
        weatherRequest.then(weatherRequestSucceeded, requestFailed);
    }
    
    //****************************************************************************************
    // retrieve and display weather forcast information from API
    //****************************************************************************************
    function weatherRequestSucceeded(response) {
        
        //convert json string to JSON with dojo
        var jsonstring = dojoJson.toJson(response, true);
        const json = JSON.parse(jsonstring);
        
        // remove any child elements within the weather content container
        var nodeRemove = dom.byId("weatherContent");        
        while (nodeRemove.firstChild) {
            nodeRemove.removeChild(nodeRemove.firstChild);
        }
        
        // apply parameters for the date/time
        var dateOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric'};
        // Procedurally generate elements containing forecasts every 3 hours for the next 5 days
        for (let i = 0; i < Object.keys(json.list).length; i++) {
            
            // create an image to represent the conditions icon
            let weatherIcon = new Image(40, 40);
            let img = json.list[i].weather[0].icon;
            weatherIcon.src = "https://openweathermap.org/img/w/" + img + ".png";
            
            // Procedurally create elements to hold forecast data based on the length of the JSON data
            let newParagraph = document.createElement("P");
            newParagraph.id = "weatherinfo" + i;
            dom.byId("weatherContent").appendChild(newParagraph);
            
            // Fill the element with weather forecast data. (Note: temp converted from Kelvin to celcius)
            dom.byId("weatherinfo" + i).innerHTML =
                    //Use German date formatting
                    new Date(json.list[i].dt * 1000).toLocaleDateString('de-DE', dateOptions)
                    + "<br>" + "Temperatur: " + Math.round((json.list[i].main.temp - 273.15), 1)
                    + "&#x2103<br>" + "Bedingungen: " + json.list[i].weather[0].description + "<br>";
            dom.byId("weatherinfo" + i).appendChild(weatherIcon);
        }
    }
    
    // Function for exceptipon handling
    function requestFailed(error) {
    // If a server request fails display an error within the browser console
        console.log(error);
    }
    
    //****************************************************************************************
    // Function to toggle city layer on/off based on toggle button
    //****************************************************************************************
    function toggleCities() {

        const cityTgl = dom.byId("cityTgl");
        console.log("in the toggle function");
        
        // Ternery logic for button events
        cityTgl.value === "Remove Cities" ? cities.hide() : cities.show();
        cityTgl.value === "Remove Cities" ? cityTgl.value = "Add Cities" : cityTgl.value = "Remove Cities";
    }

});

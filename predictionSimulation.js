am5.ready(function() {

    const root = am5.Root.new("chartdiv");
    root.setThemes([am5themes_Animated.new(root)]);

    let currentProjection = am5map.geoMercator();
    const globeProjection = am5map.geoOrthographic();

    const chart = root.container.children.push(
        am5map.MapChart.new(root, {
            projection: currentProjection,
            panX: "none",
            panY: "none",
            wheelX: "none",
            wheelY: "none"
        })
    );

    const polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldHigh
        })
    );

    polygonSeries.mapPolygons.template.setAll({
        fill: am5.color(0xd9d9d9),
        stroke: am5.color(0xffffff),
        tooltipText: "{name}"
    });

    const selectedCountries = [];
    let simulationResults = [];
    let simulationIndex = 0;

    const input = document.getElementById("countryInput");
    const resultsBox = document.getElementById("searchResults");
    const selectedDiv = document.getElementById("selectedCountries");
    const counter = document.getElementById("countryCounter");
    const goButton = document.getElementById("goButton");
    const predictionBox = document.getElementById("predictionBox");
    const resetButton = document.getElementById("resetButton");
    const nextButton = document.getElementById("nextButton");

    const countryList = [];

    polygonSeries.events.on("datavalidated", function() {

        polygonSeries.mapPolygons.each(function(p) {

            const d = p.dataItem.dataContext;

            countryList.push({
                name: d.name,
                id: d.id
            });

        });

        countryList.sort((a, b) => a.name.localeCompare(b.name));

    });

    function addCountryTag(name, code) {

        const tag = document.createElement("div");
        tag.className = "countryTag";

        tag.innerHTML = name + " <span>✖</span>";

        tag.querySelector("span").onclick = function() {
            const i = selectedCountries.indexOf(code);

            if (i > -1) selectedCountries.splice(i, 1);
            
            tag.remove();

            counter.textContent = selectedCountries.length + "/5";
            goButton.disabled = selectedCountries.length !== 5;

            const poly = polygonSeries.mapPolygons.values.find(
                p => p.dataItem.dataContext.id === code
            );

            if (poly) {
                poly.set("fill", am5.color(0xd9d9d9));
            }
        };

        selectedDiv.appendChild(tag);

    }

    function selectCountry(poly) {

        const code = poly.dataItem.dataContext.id;
        const name = poly.dataItem.dataContext.name;

        if (selectedCountries.includes(code)) return;
        if (selectedCountries.length >= 5) return;

        selectedCountries.push(code);

        poly.set("fill", am5.color(0x9932CC));

        addCountryTag(name, code);

        counter.textContent = selectedCountries.length + "/5";

        if (selectedCountries.length === 5) {
            goButton.disabled = false;
        }

    }

    polygonSeries.mapPolygons.template.events.on("click", function(ev) {
        selectCountry(ev.target);
    });

    input.addEventListener("input", function() {

        const text = input.value.toLowerCase();

        resultsBox.innerHTML = "";

        if (!text) {
            resultsBox.style.display = "none";
            return;
        }

        const matches = countryList
            .filter(c => c.name.toLowerCase().startsWith(text))
            .slice(0, 10);

        matches.forEach(c => {

            const item = document.createElement("div");

            item.className = "searchItem";
            item.textContent = c.name;

            item.onclick = function() {

                const poly = polygonSeries.mapPolygons.values.find(
                    p => p.dataItem.dataContext.id === c.id
                );

                selectCountry(poly);

                resultsBox.style.display = "none";
                input.value = "";

            };

            resultsBox.appendChild(item);

        });

        resultsBox.style.display = "block";

    });

    input.addEventListener("keydown", function(e) {

        if (e.key === "Enter") {

            const text = input.value.toLowerCase();

            let match = countryList.find(
                c => c.name.toLowerCase() === text
            );

            if (!match) {

                const firstSuggestion = countryList.find(
                    c => c.name.toLowerCase().startsWith(text)
                );

                if (firstSuggestion) match = firstSuggestion;

            }

            if (!match) return;

            const poly = polygonSeries.mapPolygons.values.find(
                p => p.dataItem.dataContext.id === match.id
            );

            selectCountry(poly);

            resultsBox.style.display = "none";
            input.value = "";

        }

    });

    async function fetchData(country) {
        const indicator = "ER.H2O.FWTL.ZS";

        const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?date=2015:2022&format=json&per_page=100`;

        const res = await fetch(url);
        const json = await res.json();

        if (!json || !json[1]) return null;

        const targetYear = 2022;

        let best = null;
        let smallestDiff = Infinity;

        json[1].forEach(d => {
            if (d.value !== null) {
                const year = parseInt(d.date);
                const diff = Math.abs(year - targetYear);

                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    best = {
                        value: Number(d.value),
                        year: year
                    };
                }
            }
        });

        if (smallestDiff > 5) return null;
        return best;
    }

    function getStatus(value) {

        if (value === null) return "No Data";
        if (value < 10) return "Low Water Stress";
        if (value < 20) return "Low-Moderate Stress";
        if (value < 40) return "Moderate Stress";
        if (value < 80) return "High Water Stress";

        return "Extremely High Stress";

    }

    function getStatusColor(value) {

        if (value === null) return am5.color(0xA5A5A5);
        if (value < 10) return am5.color(0x6EBBE0);
        if (value < 20) return am5.color(0xEDC230);
        if (value < 40) return am5.color(0xDE682F);
        if (value < 80) return am5.color(0xC4293D);

        return am5.color(0x8A1F43);

    }

    function getStatusTextColor(value) {

        if (value === null) return "#A5A5A5";
        if (value < 10) return "#6EBBE0";
        if (value < 20) return "#EDC230";
        if (value < 40) return "#DE682F";
        if (value < 80) return "#C4293D";

        return "#8A1F43";

    }

    function predictStressByYear(current) {

        if (current === null) return null;

        return {
            2035: current * 1.15,
            2050: current * 1.35,
            2075: current * 1.70,
            2100: current * 2.10
        };

    }

    async function runSimulation() {

        predictionBox.innerHTML = "Loading data...";

        simulationResults = [];
        simulationIndex = 0;

        for (const code of selectedCountries) {

            const dataObj = await fetchData(code);
            const val = dataObj ? dataObj.value : null;
            const year = dataObj ? dataObj.year : null;

            const poly = polygonSeries.mapPolygons.values.find(
                p => p.dataItem.dataContext.id === code
            );

            const name = poly.dataItem.dataContext.name;

            const predictions = predictStressByYear(val);

            simulationResults.push({
                name,
                current: val,
                year: year,
                predictions
            });

        }

        predictionBox.innerHTML = "";

        nextButton.textContent = "Next Country";
        nextButton.style.display = "inline-block";

        showCountryResult();

        document.getElementById("simulationOverlay").style.display = "none";

    }

    function spinToCountry(name) {

        const poly = polygonSeries.mapPolygons.values.find(
            p => p.dataItem.dataContext.name === name
        );

        if (!poly) return;

        const geo = poly.dataItem.dataContext.geometry;

        const centroid = am5map.getGeoCentroid(geo);

        chart.animate({
            key: "rotationX",
            to: -centroid.longitude,
            duration: 1200
        });

        chart.animate({
            key: "rotationY",
            to: -centroid.latitude,
            duration: 1200
        });

    }

    function showCountryResult() {

        const data = simulationResults[simulationIndex];

        spinToCountry(data.name);

        const poly = polygonSeries.mapPolygons.values.find(
            p => p.dataItem.dataContext.name === data.name
        );

        if (poly) {
            poly.set("fill", getStatusColor(data.current));
        }

        predictionBox.innerHTML = `
<b>${data.name}</b><br>

Current Stress (${data.year ?? "Latest"}):
<span style="color:${getStatusTextColor(data.current)}">
${data.current ? data.current.toFixed(3) : "No Data"}%
</span>
(${getStatus(data.current)})<br><br>

2035:
<span style="color:${getStatusTextColor(data.predictions[2035])}">
${data.predictions ? data.predictions[2035].toFixed(3) : "No Data"}%
</span>
(${getStatus(data.predictions[2035])})<br>

2050:
<span style="color:${getStatusTextColor(data.predictions[2050])}">
${data.predictions ? data.predictions[2050].toFixed(3) : "No Data"}%
</span>
(${getStatus(data.predictions[2050])})<br>

2075:
<span style="color:${getStatusTextColor(data.predictions[2075])}">
${data.predictions ? data.predictions[2075].toFixed(3): "No Data"}%
</span>
(${getStatus(data.predictions[2075])})<br>

2100:
<span style="color:${getStatusTextColor(data.predictions[2100])}">
${data.predictions ? data.predictions[2100].toFixed(3) : "No Data"}%
</span>
(${getStatus(data.predictions[2100])})
`;

    }

    goButton.onclick = function() {

        document.getElementById("simulationOverlay").style.display = "flex";

        setTimeout(function() {

            chart.set("projection", globeProjection);

            runSimulation();

        }, 5000);

    };

    nextButton.onclick = function() {

        simulationIndex++;

        if (simulationIndex >= simulationResults.length) {

            predictionBox.innerHTML = "Trial complete.";

            nextButton.style.display = "none";
            resetButton.style.display = "inline-block";

            polygonSeries.mapPolygons.each(function(poly) {
                poly.set("fill", am5.color(0xd9d9d9));
            });

            return;

        }

        if (simulationIndex === simulationResults.length - 1) {
            nextButton.textContent = "Finish Trial";
        } else {
            nextButton.textContent = "Next Country";
        }

        showCountryResult();

    };

    resetButton.onclick = function() {
        selectedCountries.length = 0;

        selectedDiv.innerHTML = "";
        predictionBox.innerHTML = "";
        counter.textContent = "0/5";

        goButton.disabled = true;

        nextButton.style.display = "none";
        resetButton.style.display = "none";

        chart.animate({
            key: "rotationX",
            to: 0,
            duration: 600
        });

        chart.animate({
            key: "rotationY",
            to: 0,
            duration: 0,
            callback: function() {
                chart.set("projection", am5map.geoMercator());
            }
        });

        polygonSeries.mapPolygons.each(function(poly) {
            poly.set("fill", am5.color(0xd9d9d9));
        });
    };

});
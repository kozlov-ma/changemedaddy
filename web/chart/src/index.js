import {Charts} from "./model";

const turquoise = "#03866a";
const red = "#dc2020";
const lightGrey = "rgba(140,137,137,0.2)";
const grey = "rgba(79,75,75,0.2)";

function getTimeInMinutesFromDate(d) {
    return d.getTime() / (1000 * 60);
}

function getStingDateYYYYMMDD(timestamp) {
    const dateObject = new Date(timestamp * 1000);
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, "0");
    const day = String(dateObject.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function timestampHaveSimilarDate(timestamp1, timestamp2) {
    const date1 = getStingDateYYYYMMDD(timestamp1);
    const date2 = getStingDateYYYYMMDD(timestamp2);
    return date1 === date2;
}

function generateRandomData(num) {
    const data = [];

    let prevClose = 1000;
    let curDate = new Date();
    curDate.setDate(curDate.getDate() - num);
    for (let i = 0; i < num; i++) {
        const open = prevClose;
        const close = open + Math.round((Math.random() - 0.5) * 10);
        const high = Math.max(open, close) + Math.round(Math.random() * 10);
        const low = Math.min(open, close) - Math.round(Math.random() * 10);

        const color = close >= open ? turquoise : red;

        curDate.setDate(curDate.getDate() + 1);
        const year = curDate.getFullYear();
        const month = String(curDate.getMonth() + 1).padStart(2, "0");
        const day = String(curDate.getDate()).padStart(2, "0");
        data.push({
            time: Date.parse(`${year}-${month}-${day}`) / 1000,
            open: open,
            high: high,
            low: low,
            close: close,
            color: color,
        });

        prevClose = close;
    }

    return data;
}

function getMarketInterval(openDate, deadline) {
    let candlesOnScreenCount = ((window.innerWidth - 80) / 210) * 30;
    let now = new Date();
    let to = deadline < now ? deadline : now;
    console.log(to);
    let diffInMinutes = getTimeInMinutesFromDate(to) - getTimeInMinutesFromDate(openDate);
    let intervalInMinutes = Math.floor(diffInMinutes / candlesOnScreenCount);
    console.log(intervalInMinutes);

    let intervalType;
    switch (true) {
        case intervalInMinutes <= 1:
            intervalType = 1;
            break;
        case intervalInMinutes <= 2:
            intervalType = 6;
            break;
        case intervalInMinutes <= 3:
            intervalType = 7;
            break;
        case intervalInMinutes <= 5:
            intervalType = 2;
            break;
        case intervalInMinutes <= 10:
            intervalType = 8;
            break;
        case intervalInMinutes <= 15:
            intervalType = 3;
            break;
        case intervalInMinutes <= 30:
            intervalType = 9;
            break;
        case intervalInMinutes <= 60:
            intervalType = 4;
            break;
        case intervalInMinutes <= 2 * 60:
            intervalType = 10;
            break;
        case intervalInMinutes <= 4 * 60:
            intervalType = 11;
            break;
        case intervalInMinutes <= 24 * 60:
            intervalType = 5;
            break;
        case intervalInMinutes <= 7 * 24 * 60:
            intervalType = 12;
            break;
        case intervalInMinutes <= 4 * 7 * 24 * 60:
            intervalType = 13;
            break;
        default:
            intervalType = 0;
            break;
    }

    console.log(intervalType);
    return [intervalType, Math.floor(candlesOnScreenCount)];
}

class ChartComponent extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({mode: "open"});
        const template = document.createElement("template");
        template.innerHTML = `<div>
                            <div id="chart-container"></div>
                            <button id="scrollBtn">>></button>
                          </div>`;
        const clonedTemplate = document.importNode(template.content, true);
        this.shadowRoot.appendChild(clonedTemplate);

        this.shadowRoot.getElementById('chart-container').style.display = 'none';
        this.shadowRoot.getElementById('scrollBtn').style.display = 'none';
    }

    connectedCallback() {
        this.chart = null;
        this.series = null;
        this.lineSeries = null;

        this.candlesOnScreenCount = null;
        this.propIndex = null;
        this.fromInSeconds = null;

        this.loadChart();
    }

    loadChart() {
        let url = this.getAttribute("url");
        const urlParts = url.split("/");
        let openDate, deadline;
        for (let i = 0; i < urlParts.length; i++) {
            if (urlParts[i] === "from") {
                openDate = new Date(decodeURIComponent(urlParts[i + 1]));
                this.fromInSeconds = openDate.getTime() / 1000;
            } else if (urlParts[i] === "to") {
                deadline = new Date(decodeURIComponent(urlParts[i + 1]));
            }
        }

        let [marketInterval, candlesOnScreenCount] = getMarketInterval(openDate, deadline);
        this.candlesOnScreenCount = candlesOnScreenCount;
        console.log("candles on screen count=", this.candlesOnScreenCount);
        url += "/interval/" + marketInterval.toString();
        console.log(url);

        fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("error while download JSON data");
                }
                return response.json();
            })
            .then((json) => {
                return this.fromJSONToChartOption(json);
            })
            .then((option) => {
                const [data, timeVisible] = option;
                if (data.length !== 0) {
                    this.render(data, timeVisible);
                }
            })
            .catch((error) => {
                console.error(error);
            });
    }

    fromJSONToChartOption(jsonArr) {
        let timeVisible = false;
        let prevTime = null;
        let idx = 0;
        let minDiff = 10 ** 9

        return [
            jsonArr.map((e) => {
                const open = e["open"];
                const close = e["close"];
                const color = close >= open ? turquoise : red;
                const time = e["time"];

                const curDiff = Math.abs(time - this.fromInSeconds);
                if (curDiff < minDiff) {
                    this.propIndex = idx;
                    minDiff = curDiff;
                }
                if (timeVisible === false) {
                    if (prevTime === null) {
                        prevTime = time;
                    } else {
                        timeVisible = timestampHaveSimilarDate(prevTime, time);
                    }
                }

                idx += 1;
                return {
                    time: time,
                    open: open,
                    high: e["high"],
                    low: e["low"],
                    close: close,
                    color: color,
                };
            }),
            timeVisible,
        ];
    }

    setChartData(data) {
        console.log(data);
        this.series.setData(data);

        if (data.length > 0) {
            console.log("probIndex=", this.propIndex);
            this.lineSeries.setData([
                {time: data[this.propIndex].time, value: data[this.propIndex].open},
                {time: data[data.length - 1].time, value: data[this.propIndex].open},
            ]);

            let startRangeIndex;
            switch (true) {
                case data.length < this.candlesOnScreenCount:
                    startRangeIndex = 0;
                    break;
                case data.length - 1 - this.propIndex >= this.candlesOnScreenCount:
                    startRangeIndex = this.propIndex;
                    break;
                default:
                    startRangeIndex = data.length - this.candlesOnScreenCount;
                    break;
            }

            let startRange = data[startRangeIndex]["time"];
            let endRange = data[data.length - 1]["time"];
            this.chart.timeScale().setVisibleRange({
                from: startRange,
                to: endRange,
            });
        }
    }

    render(data, timeVisible) {
        this.shadowRoot.getElementById('chart-container').style.display = 'block';
        this.shadowRoot.getElementById('scrollBtn').style.display = 'block';

        const chartContainer = this.shadowRoot.getElementById("chart-container");
        const chart = Charts.createChart(chartContainer, {
            grid: {
                vertLines: {color: lightGrey},
                horzLines: {color: lightGrey},
            },
            height: 600,
        });
        this.chart = chart;

        this.chart.priceScale("right").applyOptions({
            borderVisible: false,
            autoScale: false,
            scaleMargins: {
                top: 0.1,
                bottom: 0.2,
            },
        });
        this.chart.timeScale("down").applyOptions({
            barSpacing: 10,
            timeVisible: timeVisible,
            borderVisible: false,
        });

        this.series = this.chart.addCandlestickSeries({
            upColor: turquoise,
            downColor: red,
            borderVisible: false,
            wickUpColor: turquoise,
            wickDownColor: red,
        });

        this.lineSeries = this.chart.addLineSeries({
            priceLine: false,
            firstValueVisible: true,
            lineStyle: 1, // пунктирная
            color: grey,
            lineWidth: 1,
        });

        this.setChartData(data);

        function scrollToNow() {
            chart.timeScale().scrollToRealTime();
        }

        this.shadowRoot
            .getElementById("scrollBtn")
            .addEventListener("click", () => {
                scrollToNow();
            });

        const chartResizeListener = () => {
            const {width, height} = chartContainer.getBoundingClientRect();
            chart.resize(width, height);
        };

        window.addEventListener("resize", chartResizeListener);

        scrollToNow();
    }
}

customElements.define("chart-component", ChartComponent);

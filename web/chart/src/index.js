import {Charts} from "./model";


const turquoise = '#03866a'
const red = '#dc2020'
const lightGrey = "rgba(140,137,137,0.2)"
const grey = "rgba(79,75,75,0.2)"

function getTimeInSecondsFromString(s) {
    return new Date(s).getTime() / 1000
}

function generateRandomData(num) {
    const data = [];

    let prevClose = 1000;
    let curDate = new Date()
    curDate.setDate(curDate.getDate() - num)
    for (let i = 0; i < num; i++) {
        const open = prevClose;
        const close = open + Math.round((Math.random() - 0.5) * 10);
        const high = Math.max(open, close) + Math.round(Math.random() * 10);
        const low = Math.min(open, close) - Math.round(Math.random() * 10);

        const color = close >= open ? turquoise : red;

        curDate.setDate(curDate.getDate() + 1)
        const year = curDate.getFullYear();
        const month = String(curDate.getMonth() + 1).padStart(2, '0');
        const day = String(curDate.getDate()).padStart(2, '0');
        data.push({
            time: `${year}-${month}-${day}`,
            open: open,
            high: high,
            low: low,
            close: close,
            color: color
        });

        prevClose = close;
    }

    return data;
}

function fromJSONToChartData(jsonArr) {
    return jsonArr.map(e => {
        const open = e['open'];
        const close = e['close'];
        const color = close >= open ? turquoise : red;

        return {
            time: e['time'],
            open: open,
            high: e['high'],
            low: e['low'],
            close: close,
            color: color
        }
    });
}

class ChartComponent extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({mode: 'open'});
        const template = document.createElement('template');
        template.innerHTML = `<div>
                                <div id="chart-container"></div>
                                <button id="scrollBtn">>></button>
                              </div>`;


        const clonedTemplate = document.importNode(template.content, true);
        this.shadowRoot.appendChild(clonedTemplate);

        this.chart = null;
        this.series = null;
        this.lineSeries = null;
        this.loadChart()
    }

    loadChart() {
        fetch(this.getAttribute('url'))
            .then(response => {
                if (!response.ok) {
                    throw new Error('error while download JSON data');
                }
                return response.json();
            })
            .then(json => {
                return fromJSONToChartData(json);
            })
            .then(data => this.render(data))
            .catch(error => {
                console.error(error);
                this.render([]);
            });
    }

    setChartData(data) {
        this.series.setData(data);

        if (data.length > 0) {
            this.lineSeries.setData([{time: data[0].time, value: data[0].open}, {
                time: data[data.length - 1].time,
                value: data[0].open
            }]);

            let startRangeString = data.length >= 60 ? data[data.length - 60]['time'] : data[0]['time']
            let endRangeString = data[data.length - 1]['time']
            this.chart.timeScale().setVisibleRange({
                from: getTimeInSecondsFromString(startRangeString),
                to: getTimeInSecondsFromString(endRangeString),
            });
        }
    }


    render(data) {
        const chartContainer = this.shadowRoot.getElementById('chart-container')
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
            borderVisible: false
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

        console.log(data);
        this.setChartData(data);

        function scrollToNow() {
            chart.timeScale().scrollToRealTime();
        }

        this.shadowRoot.getElementById('scrollBtn').addEventListener('click', () => {
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

customElements.define('chart-component', ChartComponent);

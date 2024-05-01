const DayInSeconds = 86400

const turquoise = '#03866a'
const red = '#dc2020'
const lightGrey = "rgba(140,137,137,0.2)"
const grey = "rgba(79,75,75,0.2)"

function getTimeInSecondsFromString(s) {
    return new Date(s).getTime() / 1000
}

const currentLocale = window.navigator.languages[0];
const myPriceFormatter = Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: 'RUB',
}).format;

const chartContainer = document.getElementById('chart-container')
const chart = LightweightCharts.createChart(chartContainer, {
    grid: {
        vertLines: {color: lightGrey},
        horzLines: {color: lightGrey},
    },
    height: 600,
    localization: {
        priceFormatter: myPriceFormatter,
    },
});

chart.priceScale("right").applyOptions({
    borderVisible: false,
    autoScale: false,
    scaleMargins: {
        top: 0.1,
        bottom: 0.2,
    },
})

chart.timeScale("down").applyOptions({
    barSpacing: 10,
    borderVisible: false
})

const series = chart.addCandlestickSeries({
    upColor: turquoise,
    downColor: red,
    borderVisible: false,
    wickUpColor: turquoise,
    wickDownColor: red,
});

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

const data = generateRandomData(100);

series.setData(data);

const lineSeries = chart.addLineSeries({
    priceLine: false,
    firstValueVisible: true,
    lineStyle: 1, // Стиль линии (1 - пунктирная)
    color: grey,
    lineWidth: 1, // Толщина линии
});

lineSeries.setData([{ time: 0, value: data[0].open }, { time: Date.now(), value: data[0].open }]);

startRangeString = data.length >= 60 ? data[data.length - 60]['time'] : data[0]['time']
endRangeString = data[data.length - 1]['time']
chart.timeScale().setVisibleRange({
    from: getTimeInSecondsFromString(startRangeString),
    to: getTimeInSecondsFromString(endRangeString),
});

function scrollToNow() {
    chart.timeScale().scrollToRealTime();
}

scrollToNow();

document.getElementById('scrollBtn').addEventListener('click', () => {
    scrollToNow();
});

const chartResizeListener = () => {
    const { width, height } = chartContainer.getBoundingClientRect();
    chart.resize(width, height);
};

window.addEventListener("resize", chartResizeListener);
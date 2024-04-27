const turquoise = '#03866a'
const red = '#dc2020'
const lightGrey = "rgba(140,137,137,0.2)"

const currentLocale = window.navigator.languages[0];
const myPriceFormatter = Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: 'RUB',
}).format;

const chart = LightweightCharts.createChart(document.getElementById('chart-container'), {
    grid: {
        vertLines: {color: lightGrey},
        horzLines: {color: lightGrey},
    },
    height: 600,
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    localization: {
        priceFormatter: myPriceFormatter,
    },
});

chart.priceScale("right").applyOptions({
    borderVisible: false,
    autoScale: false, // disables auto scaling based on visible content
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

function scrollToNow() {
    chart.timeScale().scrollToRealTime();
}

scrollToNow();

document.getElementById('scrollBtn').addEventListener('click', () => {
    scrollToNow();
});
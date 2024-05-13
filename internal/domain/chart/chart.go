package chart

const DateFormat = "2006-01-02 15:04:05"

type Candle struct {
	Time  int64   `json:"time"`
	Open  float64 `json:"open"`
	Close float64 `json:"close"`
	High  float64 `json:"high"`
	Low   float64 `json:"low"`
}

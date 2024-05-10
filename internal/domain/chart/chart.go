package chart

const DateFormat = "2006-01-02"

type Candle struct {
	Time  int `json:"time"`
	Open  int `json:"open"`
	Close int `json:"close"`
	High  int `json:"high"`
	Low   int `json:"low"`
}

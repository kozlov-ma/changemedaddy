package chart

type Candle struct {
	Time  string `json:"time"`
	Open  int    `json:"open"`
	Close int    `json:"close"`
	High  int    `json:"high"`
	Low   int    `json:"low"`
}

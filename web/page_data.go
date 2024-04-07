package web

import (
	"changemedaddy/view"
	_ "embed"
	"html/template"
	"math"
)

//go:embed page.html
var page string
var PageTmpl = pageTemplate()

func pageTemplate() *template.Template {
	tmpl, err := template.New("tmpl").Parse(page)
	if err != nil {
		panic(err)
	}

	return tmpl
}

type PageData struct {
	PositionResponse *view.PositionResponse
	CurProfitSign    rune
	CurProfitValue   float64
	AllProfit        float64
}

func NewPageData(pr *view.PositionResponse) PageData {
	curProfit := math.Round((pr.CurPrice-pr.StartPrice)/pr.StartPrice*10000) / 100
	var curProfitSign rune
	if curProfit >= 0 {
		curProfitSign = '+'
	} else {
		curProfitSign = '-'
	}

	p := PageData{
		PositionResponse: pr,
		CurProfitSign:    curProfitSign,
		CurProfitValue:   math.Abs(curProfit),
		AllProfit:        curProfit + pr.FixedProfitP,
	}
	return p
}

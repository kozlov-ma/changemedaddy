package web

import (
	_ "embed"
	"html/template"
	"math"

	"changemedaddy/server/core"
)

//go:embed page.html
var page string
var PageTmpl = getTemplate("page", page)

//go:embed error.html
var errorPage string
var ErrorTmpl = getTemplate("err", errorPage)

func getTemplate(name string, content string) *template.Template {
	tmpl, err := template.New(name).Parse(content)
	if err != nil {
		panic(err)
	}
	return tmpl
}

type PageData struct {
	PositionResponse *core.PositionResponse
	CurProfitSign    rune
	CurProfitValue   float64
	AllProfit        float64
}

func NewPageData(pr *core.PositionResponse) PageData {
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

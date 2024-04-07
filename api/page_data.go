package api

import (
	"html/template"
	"math"
	"net/http"
	"path/filepath"
)

type PageData struct {
	PositionResponse *PositionResponse
	CurProfitSign    rune
	CurProfitValue   float64
	AllProfit        float64
}

func NewPageData(pr *PositionResponse) *PageData {
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
	return &p
}

func (p *PageData) Render(w http.ResponseWriter, r *http.Request) error {
	// TODO r не используется
	// TODO вынести web
	tmplPath := "api/template.html"
	tmpl, err := template.ParseFiles(filepath.FromSlash(tmplPath))
	if err != nil {
		return err
	}

	// TODO почему-то в w пишется ещё инфа всякая в конце (os.Stdout чтобы проверить)
	if err = tmpl.Execute(w, &p); err != nil {
		return err
	}
	return nil
}

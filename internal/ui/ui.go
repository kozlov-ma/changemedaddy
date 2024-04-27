package ui

import (
	"html/template"

	"github.com/Masterminds/sprig"
	"github.com/greatcloak/decimal"
)

func mustTemplate(s string) template.Template {
	t, err := template.New("").Funcs(sprig.FuncMap()).Parse(s)
	if err != nil {
		panic(err)
	}

	return *t
}

func withSign(d decimal.Decimal) string {
	if d.GreaterThanOrEqual(decimal.Zero) {
		return "+" + d.String()
	}

	return d.String()
}

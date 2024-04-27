package ui

import (
	"changemedaddy/internal/pkg/assert"
	"fmt"
	"html/template"

	"github.com/Masterminds/sprig"
	"github.com/greatcloak/decimal"
)

func mustTemplate(s string) template.Template {
	t, err := template.New("").Funcs(sprig.FuncMap()).Parse(s)
	assert.That(err == nil, fmt.Sprintf("couldn't parse template %q: %v", s, err))

	return *t
}

func withSign(d decimal.Decimal) string {
	if d.GreaterThanOrEqual(decimal.Zero) {
		return "+" + d.String()
	}

	return d.String()
}

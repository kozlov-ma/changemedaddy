package ui

import (
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/pkg/assert"
	"fmt"
	"github.com/goodsign/monday"
	"html/template"
	"io"
	"time"

	"github.com/Masterminds/sprig"
	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

func mergeFuncMaps(a template.FuncMap, b template.FuncMap) template.FuncMap {
	result := make(template.FuncMap)
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		if _, ok := result[k]; !ok {
			result[k] = v
		}
	}
	return result
}

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

type templateRenderer struct {
	templates *template.Template
}

func NewRenderer() *templateRenderer {
	funcs := template.FuncMap{
		"IdeaCard": IdeaCard,
		"Position": Position,
	}

	funcMap := template.FuncMap{
		"chartDateFormat": func(t time.Time) string {
			return t.Format(chart.DateFormat)
		},
		"ruDateFormat": func(t time.Time) string {
			return monday.Format(t, "2 January 2006", monday.LocaleRuRU)
		},
	}
	funcMap = mergeFuncMaps(funcMap, sprig.FuncMap())

	return &templateRenderer{
		templates: template.Must(template.New("").Funcs(sprig.FuncMap()).Funcs(funcs).ParseGlob("web/template/*.html")),
		templates: template.Must(template.New("").Funcs(funcMap).ParseGlob("web/template/*.html")),
	}
}

// Render renders a template document
func (t *templateRenderer) Render(w io.Writer, name string, data interface{}, c echo.Context) error {

	// Add global methods if data is a map
	if viewContext, isMap := data.(map[string]interface{}); isMap {
		viewContext["reverse"] = c.Echo().Reverse
	}

	return t.templates.ExecuteTemplate(w, name, data)
}

func (t *templateRenderer) Register(e *echo.Echo) {
	e.Renderer = t
}

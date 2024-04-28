package ui

import (
	"changemedaddy/internal/pkg/assert"
	"fmt"
	"html/template"
	"io"

	"github.com/Masterminds/sprig"
	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
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

type templateRenderer struct {
	templates *template.Template
}

func NewRenderer() *templateRenderer {
	return &templateRenderer{
		templates: template.Must(template.New("").Funcs(sprig.FuncMap()).ParseGlob("web/template/*.html")),
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

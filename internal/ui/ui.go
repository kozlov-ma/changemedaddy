package ui

import (
	"html/template"
	"io"

	"github.com/Masterminds/sprig"
	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

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

	return &templateRenderer{
		templates: template.Must(template.New("").Funcs(sprig.FuncMap()).Funcs(funcs).ParseGlob("web/template/*.html")),
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

package template

import (
	"html/template"
	"io"

	"github.com/Masterminds/sprig"
	"github.com/labstack/echo/v4"
)

type T struct {
	templates *template.Template
}

func (t *T) Render(w io.Writer, name string, data interface{}, c echo.Context) error {
	return t.templates.ExecuteTemplate(w, name, data)
}

func New(glob string) *T {
	t, err := template.New("").Funcs(sprig.FuncMap()).ParseGlob(glob)
	if err != nil {
		panic(err)
	}

	return &T{
		templates: t,
	}
}

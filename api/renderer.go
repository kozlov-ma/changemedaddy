package api

import (
	"html/template"
	"net/http"
)

type Page struct {
	Data *PositionResponse
}

func NewPage(posResp *PositionResponse) *Page {
	p := Page{Data: posResp}
	return &p
}

func (p *Page) Render(w http.ResponseWriter, r *http.Request) error {
	// TODO r не используется
	// TODO относительные пути
	// TODO вынести web
	tmpl, err := template.ParseFiles("/Users/dimasta/work/go/changemedaddy/api/template.html")
	if err != nil {
		return err
	}

	// TODO почему-то в w пишется ещё инфа всякая в конце (os.Stdout чтобы проверить)
	if err = tmpl.Execute(w, &p.Data); err != nil {
		return err
	}
	return nil
}

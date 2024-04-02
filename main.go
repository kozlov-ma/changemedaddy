package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"github.com/go-playground/validator/v10"
	"net/http"
)

func main() {
	db := inmem.New()
	v := validator.New()
	api := api.New(db, v)

	http.ListenAndServe(":80", api.NewRouter())
}

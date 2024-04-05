package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"net/http"
)

func main() {
	db := inmem.New()
	api := api.New(db)

	http.ListenAndServe(":80", api.NewRouter())
}

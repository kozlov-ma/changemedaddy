package main

import (
	_ "database/sql"
	"fmt"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type Analyst struct {
	Id   string `db:"id"`
	Name string `db:"name"`
}

func main1() {
	db, err := sqlx.Connect("postgres", "user=postgres dbname=demo password=5103 sslmode=disable")
	if err != nil {
		panic(err)
	}

	analystName := "MK"
	tx := db.MustBegin()
	analyst := Analyst{}
	err = db.Get(&analyst, `select * from analyst where name=$1`, analystName)
	if err = tx.Commit(); err != nil {
		panic(err)
	}

	fmt.Println(analyst)

	//tx := db.MustBegin()
	//tx.MustExec(
	//	`insert into positions (analyst_id, slug, ticker, type, target_price, created_at, deadline) values ($1, $2, $3, $4, $5, $6, $7)`,
	//	1, "magnit-temka-zhoskaia-rebiat", "MGNT", "long", 8000, time.Now(), time.Now(),
	//)
	//if err = tx.Commit(); err != nil {
	//	panic(err)
	//}
}

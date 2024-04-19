package postge

type analyst struct {
	Id   int    `db:"id"`
	Name string `db:"name"`
	Slug string `db:"slug"`
}

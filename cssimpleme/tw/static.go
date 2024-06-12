package tw

import "cssimpleme/ast"

func singleStatic(name, prop, value string) {
	Classes.Static(name, ast.Decl(prop, value))
}

func init() {
	singleStatic("absolute", "position", "absolute")
	singleStatic("relative", "position", "relative")
	singleStatic("isolate", "isolation", "isolate")

	Classes.Static("mx-auto", ast.Decl("margin-left", "auto"), ast.Decl("margin-right", "auto"))

	singleStatic("flex", "display", "flex")

	Classes.Static(
		"hover:ring-gray-900/20",
		ast.Decl("--tw-ring-color", "rgb(17 24 39 / 0.2)"),
	)
	Classes.Static(
		"ring-gray-900/10",
		ast.Decl("--tw-ring-color", "rgb(17 24 39 / 0.1)"),
	)
}

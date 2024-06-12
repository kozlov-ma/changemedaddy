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
}

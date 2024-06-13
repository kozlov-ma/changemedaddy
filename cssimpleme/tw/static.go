package tw

import (
	"cssimpleme/ast"
)

func singleStatic(name, prop, value string) {
	Classes.Static(name, ast.Decl(prop, value))
}

func shadow(name, shadow, shadowColored string) {
	Classes.Static(
		name,
		ast.Decl("--x3-shadow", shadow),
		ast.Decl("--x3-shadow-colored", shadowColored),
		ast.Decl("box-shadow", "var(--x3-ring-offset-shadow, 0 0 #0000), var(--x3-ring-shadow, 0 0 #0000), var(--x3-shadow)"),
	)
}

func init() {
	singleStatic("absolute", "position", "absolute")
	singleStatic("relative", "position", "relative")
	singleStatic("isolate", "isolation", "isolate")

	Classes.Static("mx-auto", ast.Decl("margin-left", "auto"), ast.Decl("margin-right", "auto"))

	singleStatic("flex", "display", "flex")
	singleStatic("inline-flex", "display", "inline-flex")
	singleStatic("grid", "display", "grid")
	singleStatic("hidden", "display", "none")

	singleStatic("w-full", "width", "100%")

	singleStatic("max-w-2xl", "max-width", "42rem")
	singleStatic("max-w-3xl", "max-width", "48rem")
	singleStatic("max-w-5xl", "max-width", "64rem")

	singleStatic("flex-1", "flex", "1 1 0%")

	singleStatic("animate-pulse", "animation", "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite")

	singleStatic("auto-rows-auto", "grid-auto-rows", "auto")

	singleStatic("flex-row", "flex-direction", "row")
	singleStatic("flex-col", "flex-direction", "column")

	singleStatic("items-center", "align-items", "center")

	singleStatic("justify-start", "justify-content", "flex-start")
	singleStatic("justify-center", "justify-content", "center")
	singleStatic("justify-between", "justify-content", "space-between")

	singleStatic("overflow-hidden", "overflow", "hidden")
	singleStatic("whitespace-nowrap", "white-space", "nowrap")

	singleStatic("rounded", "border-radius", "0.25rem")
	singleStatic("rounded-full", "border-radius", "9999px")
	singleStatic("rounded-lg", "border-radius", "0.5rem")
	singleStatic("rounded-md", "border-radius", "0.375rem")

	singleStatic("border-solid", "border-style", "solid")

	singleStatic("bg-opacity-10", "--x3-bg-opacity", "0.1")
	singleStatic("bg-opacity-20", "--x3-bg-opacity", "0.2")
	singleStatic("bg-opacity-30", "--x3-bg-opacity", "0.3")
	singleStatic("bg-opacity-40", "--x3-bg-opacity", "0.4")
	singleStatic("bg-opacity-50", "--x3-bg-opacity", "0.5")
	singleStatic("bg-opacity-60", "--x3-bg-opacity", "0.6")
	singleStatic("bg-opacity-70", "--x3-bg-opacity", "0.7")
	singleStatic("bg-opacity-80", "--x3-bg-opacity", "0.8")
	singleStatic("bg-opacity-90", "--x3-bg-opacity", "0.9")

	singleStatic("bg-gradient-to-tr", "background-image", "linear-gradient(to top right, var(--x3-gradient-stops))")

	singleStatic("text-center", "text-align", "center")
	singleStatic("align-middle", "vertical-align", "middle")

	Classes.Static("text-2xl", ast.Decl("font-size", "1.5rem"), ast.Decl("line-height", "2rem"))
	Classes.Static("text-3xl", ast.Decl("font-size", "1.875rem"), ast.Decl("line-height", "2.25rem"))
	Classes.Static("text-4xl", ast.Decl("font-size", "2.25rem"), ast.Decl("line-height", "2.5rem"))
	Classes.Static("text-6xl", ast.Decl("font-size", "3.75rem"), ast.Decl("line-height", "1"))

	Classes.Static("text-lg", ast.Decl("font-size", "1.125rem"), ast.Decl("line-height", "1.75rem"))
	Classes.Static("text-sm", ast.Decl("font-size", "0.875rem"), ast.Decl("line-height", "1.25rem"))
	Classes.Static("text-xl", ast.Decl("font-size", "1.25rem"), ast.Decl("line-height", "1.75rem"))

	singleStatic("font-bold", "font-weight", "700")
	singleStatic("font-medium", "font-weight", "500")
	singleStatic("font-semibold", "font-weight", "600")

	singleStatic("italic", "font-style", "italic")

	singleStatic("tracking-tight", "letter-spacing", "-0.025em")

	singleStatic("opacity-30", "opacity", "0.3")
	singleStatic("opacity-50", "opacity", "0.3")

	shadow(
		"shadow-lg",
		"0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
		"0 10px 15px -3px var(--x3-shadow-color), 0 4px 6px -4px var(--x3-shadow-color)",
	)
	shadow(
		"shadow-md",
		"0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
		"--x3-shadow-colored: 0 4px 6px -1px var(--x3-shadow-color), 0 2px 4px -2px var(--x3-shadow-color)",
	)
	shadow(
		"shadow-sm",
		"0 1px 2px 0 var(--x3-shadow-color)",
		"0 1px 2px 0 var(--x3-shadow-color)",
	)

	Classes.Static("outline-none", ast.Decl("outline", "2px solid transparent"), ast.Decl("outline-offset", "2px"))
	Classes.Static("outline", ast.Decl("outline-style", "solid"))

	Classes.Static("outline-1", ast.Decl("outline-width", "1px"))
	Classes.Static("outline-2", ast.Decl("outline-width", "2px"))
	Classes.Static("outline-3", ast.Decl("outline-width", "3px"))
	Classes.Static("outline-4", ast.Decl("outline-width", "4px"))

	Classes.Static(
		"blur-3xl",
		ast.Decl("--x3-blur", "blur(64px)"),
		ast.Decl("filter", "var(--x3-blur) var(--x3-brightness) var(--x3-contrast) var(--x3-grayscale) var(--x3-hue-rotate) var(--x3-invert) var(--x3-saturate) var(--x3-sepia) var(--x3-drop-shadow)"),
	)

	Classes.Static(
		"transition",
		ast.Decl("transition-property", "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, -webkit-backdrop-filter"),
		ast.Decl("transition-property", "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter"),
		ast.Decl("transition-property", "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, -webkit-backdrop-filter"),
		ast.Decl("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)"),
		ast.Decl("transition-duration", "150ms"),
	)

	Classes.Static(
		"transition-colors",
		ast.Decl("transition-property", "color, background-color, border-color, text-decoration-color, fill, stroke"),
		ast.Decl("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)"),
		ast.Decl("transition-duration", "150ms"),
	)

	singleStatic("duration-300", "transition-duration", "300ms")
	singleStatic("duration-400", "transition-duration", "400ms")
	singleStatic("duration-700", "transition-duration", "700ms")

	Classes.Static(
		"[appearance:textfield]",
		ast.Decl("-webkit-appearance", "textfield"),
		ast.Decl("-moz-appearance", "textfield"),
		ast.Decl("appearance", "textfield"),
	)

	Classes.Static(
		"transition-all",
		ast.Decl("transition-property", "all"),
		ast.Decl("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)"),
		ast.Decl("transition-duration", "150ms"),
	)

	Classes.Static(
		"ring-gray-900/20",
		ast.Decl("--x3-ring-color", "rgb(17 24 39 / 0.2)"),
	)

	Classes.Static(
		"ring-gray-900/10",
		ast.Decl("--x3-ring-color", "rgb(17 24 39 / 0.1)"),
	)

	Classes.Static(
		"translate-x-1/2",
		ast.Decl("--x3-translate-x", "-50%"),
		ast.Decl("transform", "translate(var(--x3-translate-x), var(--x3-translate-y)) rotate(var(--x3-rotate)) skewX(var(--x3-skew-x)) skewY(var(--x3-skew-y)) scaleX(var(--x3-scale-x)) scaleY(var(--x3-scale-y))"),
	)

	singleStatic("transform-gpu", "transform", "translate3d(var(--x3-translate-x), var(--x3-translate-y), 0) rotate(var(--x3-rotate)) skewX(var(--x3-skew-x)) skewY(var(--x3-skew-y)) scaleX(var(--x3-scale-x)) scaleY(var(--x3-scale-y))")

	singleStatic("pointer-events-none", "pointer-events", "none")

	singleStatic("to-[#9089fc]", "--x3-gradient-to", "#9089fc var(--x3-gradient-to-position)")
	Classes.Static(
		"from-[#ff80b5]",
		ast.Decl("--x3-gradient-from", "#ff80b5 var(--x3-gradient-from-position)"),
		ast.Decl("--x3-gradient-to", "rgb(255 128 181 / 0) var(--x3-gradient-to-position)"),
		ast.Decl("--x3-gradient-stops", "var(--x3-gradient-from), var(--x3-gradient-to)"),
	)

	singleStatic("overscroll-none", "overscroll-behavior", "none")
}

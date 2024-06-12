package tw

func init() {
	Variants.Selector("sm", "@media (min-width: 640px)")
	Variants.Selector("md", "@media (min-width: 768px)")
	Variants.Selector("lg", "@media (min-width: 1024px)")
	Variants.Selector("dark", "@media (prefers-color-scheme: dark)")

	Variants.PseudoClass("hover")
	Variants.PseudoClass("focus")
	Variants.PseudoClass("focus-visible")
	Variants.PseudoClass("disabled")
}

use dep::compressed_string::CompressedString;

// The Symbol is a wrapper around the CompressedString library
// It is used to store the symbol of the token
// in a compressed format
struct Symbol {
    symbol: CompressedString<5>,
}

impl Symbol {
    // Get a Symbol from a string
    pub fn from_str(symbol: str<5>) -> Self {
        Symbol { symbol: CompressedString::new(symbol) }
    }

    // Get the symbol as a string
    pub fn as_str(self) -> str<5> {
        self.symbol.as_str()
    }
} 
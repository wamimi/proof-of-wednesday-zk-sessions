use dep::compressed_string::CompressedString;

// The Name is a wrapper around the CompressedString library
// It is used to store the name of the token
// in a compressed format
struct Name {
    name: CompressedString<30>,
}

impl Name {
    // Get a Name from a string
    pub fn from_str(name: str<30>) -> Self {
        Name { name: CompressedString::new(name) }
    }

    // Get the name as a string
    pub fn as_str(self) -> str<30> {
        self.name.as_str()
    }
} 
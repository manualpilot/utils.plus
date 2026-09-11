import type { PageContent } from "../page-document.ts";

export default {
  related: ["/hasher", "/keygen", "/cryptography", "/otp"],
  howItWorks: [
    "A password is drawn as the page opens and again on every change, from the browser's `crypto.getRandomValues`. Nothing is sent anywhere, and the link in the address bar carries the settings but never the password. Length runs from 1 to 1,024 characters and opens at 20.",
    "The four sliders are shares of the length, not probabilities. They are scaled to fill it and each type gets exactly its share, rounded so the counts add up to the length, with the count shown under each slider; a type at 0% is left out. The characters are then shuffled, so the types never sit in blocks.",
    {
      table: [
        ["Type", "Characters", "Opens at"],
        ["Lowercase", "`a`–`z`, 26", "40%"],
        ["Uppercase", "`A`–`Z`, 26", "30%"],
        ["Numbers", "`0`–`9`, 10", "20%"],
        ["Special characters", "`!#$%&()*+,-./:;<=>?@[]^_{|}~`, 28", "10%"],
      ],
    },
    "Passphrase draws whole words from lists of English nouns, verbs and adjectives, between 9,668 and 9,806 words each once anything shorter than three letters or containing a non-letter is dropped. The same share-and-shuffle rule applies. It opens at 8 words split 40/20/40 in lower case with spaces between, and can be capitalised or upper case and joined by a dash, underscore, pipe, plus, backslash or slash.",
  ],
  examples: [
    {
      title: "The default password",
      blocks: [
        { code: "Length 20 at 40/30/20/10 → 8 lowercase, 6 uppercase, 4 numbers, 2 special\n\n2kPOoTduR6q7LxpLp>+4" },
        "One real draw. A fixed 8/6/4/2 split in a random order carries about 119 bits of entropy; letting each of the 20 characters be any of the 90 would carry about 130. The ten bits are the price of guaranteeing every type appears.",
      ],
    },
    {
      title: "The default passphrase",
      blocks: [
        {
          code:
            "8 words at 40/20/40 → 3 nouns, 2 verbs, 3 adjectives\n\nremarkable writers courts carts anionic striped slapping outdo",
        },
        "One real draw. Each noun is one of 9,668, each verb one of 9,806 and each adjective one of 9,764, which is at least 106 bits before the shuffled order adds anything.",
      ],
    },
  ],
  problems: [
    {
      title: "The site says the password needs a symbol",
      blocks: [
        {
          code:
            "Length 4 at 40/30/20/10 → 2 lowercase, 1 uppercase, 1 number, 0 special\nLength 7 at 40/30/20/10 → 3 lowercase, 2 uppercase, 1 number, 1 special",
        },
        "A 10% share of four characters is 0.4 of a character, and it loses the rounding. Short passwords need a larger share, or a longer length, for every type to be guaranteed one place.",
      ],
    },
    {
      title: "The site rejects a character",
      blocks: [
        "Some sites accept only some symbols, or none. Set Special characters to 0% for letters and digits alone. The page already leaves out both quotes, the backslash, the backtick and the space, which are the characters that need escaping in a shell, a string literal or JSON. The Backslash separator brings one back into a passphrase.",
      ],
    },
    {
      title: "A passphrase contains a name or an odd word",
      blocks: [
        "The lists are large, so they include surnames such as `schmidt`, rare words such as `anionic`, and words such as `work` that appear in more than one list. The strength comes from the number of words there are to pick from, not from what they mean; regenerate if a draw is hard to remember.",
      ],
    },
  ],
  faq: [
    {
      question: "How long should a password be?",
      answer:
        "NIST's SP 800-63B asks services to require at least 15 characters for a password used on its own and 8 when it is one factor of several, and to allow at least 64. The page's 20-character default clears both; a password manager can store 64 as easily as 20.",
    },
    {
      question: "Does a password need every character type?",
      answer:
        "No. The same NIST guideline tells services not to impose composition rules at all, and a little more length makes up for a smaller alphabet: 22 characters of letters alone, split 50/50 between the cases, carry about 123 bits, more than the default 20-character mix.",
    },
    {
      question: "Password or passphrase?",
      answer:
        "A password where a password manager fills it in, and a passphrase where a person types it, such as the manager's own master password or a disk encryption prompt. The default passphrase is at least 106 bits against the default password's 119, and is much easier to type without a mistake.",
    },
    {
      question: "Is the randomness biased?",
      answer:
        "No. Each character and each word is picked with rejection sampling over `crypto.getRandomValues`, which throws away the values that would make a plain modulo favour the start of an alphabet or list, and the order is a Fisher–Yates shuffle from the same source.",
    },
  ],
  references: [
    {
      title: "NIST SP 800-63B-4, Authentication and Authenticator Management",
      url: "https://pages.nist.gov/800-63-4/sp800-63b.html",
    },
    {
      title: "Crypto.getRandomValues(), MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues",
    },
    { title: "EFF Dice-Generated Passphrases", url: "https://www.eff.org/dice" },
  ],
} satisfies PageContent;

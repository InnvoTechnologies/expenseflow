export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];

  function convertSection(n: number): string {
    let section = "";
    if (n >= 100) {
      section += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      section += teens[n - 10] + " ";
    } else {
      if (n >= 20) {
        section += tens[Math.floor(n / 10)] + " ";
        n %= 10;
      }
      if (n > 0) {
        section += units[n] + " ";
      }
    }
    return section;
  }

  let words = "";
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let tempNum = integerPart;
  let scaleIndex = 0;

  if (integerPart === 0) {
    words = "Zero ";
  } else {
    while (tempNum > 0) {
      const section = tempNum % 1000;
      if (section > 0) {
        words = convertSection(section) + scales[scaleIndex] + " " + words;
      }
      tempNum = Math.floor(tempNum / 1000);
      scaleIndex++;
    }
  }

  words = words.trim();

  if (decimalPart > 0) {
    words += " and " + convertSection(decimalPart).trim() + " Cents";
  }

  return words.trim();
}

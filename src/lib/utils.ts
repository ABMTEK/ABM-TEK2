import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];

  const convertLessThanOneThousand = (n: number): string => {
    let res = "";
    if (n >= 100) {
      res += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      res += teens[n - 10] + " ";
    } else if (n >= 20) {
      res += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n >= 1 && n <= 9) {
      res += ones[n] + " ";
    }
    return res.trim();
  };

  const thousands = ["", "Thousand", "Million", "Billion"];
  let res = "";
  let i = 0;

  let integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  while (integerPart > 0) {
    if (integerPart % 1000 !== 0) {
      res = convertLessThanOneThousand(integerPart % 1000) + " " + thousands[i] + " " + res;
    }
    integerPart = Math.floor(integerPart / 1000);
    i++;
  }

  res = res.trim() + " Naira";

  if (decimalPart > 0) {
    res += " and " + convertLessThanOneThousand(decimalPart) + " Kobo Only";
  } else {
    res += " Only";
  }

  return res.trim();
}

import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime)

// Format date to DD/MM/YY
export const formatDate = (dateString: string) => {
    return dayjs(dateString).format('DD/MM/YY')
}

// Format relative time (e.g. "2 hours ago")
export const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return dayjs(dateString).fromNow()
}

// Format duration in seconds to a human-readable format
export const formatDuration = (seconds: number) => {
    if (seconds < 60) {
        return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
    }
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes < 60) {
        if (remainingSeconds === 0) {
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
        }
        const minuteText = minutes === 1 ? 'minute' : 'minutes'
        const secondText = remainingSeconds === 1 ? 'second' : 'seconds'
        return `${minutes} ${minuteText} ${remainingSeconds} ${secondText}`
    }
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    const hourText = hours === 1 ? 'hour' : 'hours'
    const minuteText = remainingMinutes === 1 ? 'minute' : 'minutes'
    const secondText = remainingSeconds === 1 ? 'second' : 'seconds'
    
    if (remainingMinutes === 0 && remainingSeconds === 0) {
        return `${hours} ${hourText}`
    } else if (remainingSeconds === 0) {
        return `${hours} ${hourText} ${remainingMinutes} ${minuteText}`
    } else if (remainingMinutes === 0) {
        return `${hours} ${hourText} ${remainingSeconds} ${secondText}`
    }
    
    return `${hours} ${hourText} ${remainingMinutes} ${minuteText} ${remainingSeconds} ${secondText}`
}

// Calculate next billing date based on start date and billing cycle
export function calculateNextBillingDate(
    startDate: Date | string,
    billingCycle: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
): Date {
    const start = typeof startDate === "string" ? new Date(startDate) : startDate;
    const next = new Date(start);
    const now = new Date();

    // If start date is in the future, return it
    if (start > now) {
        return start;
    }

    // Calculate how many cycles have passed since start
    let cyclesPassed = 0;
    let increment: number;

    switch (billingCycle) {
        case "DAILY":
            increment = 1; // days
            cyclesPassed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            break;
        case "WEEKLY":
            increment = 7; // days
            cyclesPassed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
            break;
        case "MONTHLY":
            increment = 1; // months
            cyclesPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
            if (now.getDate() < start.getDate()) {
                cyclesPassed--;
            }
            break;
        case "QUARTERLY":
            increment = 3; // months
            const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
            cyclesPassed = Math.floor(monthsDiff / 3);
            if (now.getDate() < start.getDate()) {
                cyclesPassed--;
            }
            break;
        case "YEARLY":
            increment = 1; // years
            cyclesPassed = now.getFullYear() - start.getFullYear();
            if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) {
                cyclesPassed--;
            }
            break;
    }

    // Calculate next billing date
    const nextBilling = new Date(start);
    
    if (billingCycle === "DAILY" || billingCycle === "WEEKLY") {
        nextBilling.setDate(start.getDate() + (cyclesPassed + 1) * increment);
    } else if (billingCycle === "MONTHLY" || billingCycle === "QUARTERLY") {
        nextBilling.setMonth(start.getMonth() + (cyclesPassed + 1) * increment);
    } else if (billingCycle === "YEARLY") {
        nextBilling.setFullYear(start.getFullYear() + (cyclesPassed + 1));
    }

    return nextBilling;
} 
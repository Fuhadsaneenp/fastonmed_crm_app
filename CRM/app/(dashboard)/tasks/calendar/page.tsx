import ClientWorkCalendar from "@/components/calendar/ClientWorkCalendar";

export const metadata = {
  title: "Client Work Calendar | FastonMed CRM",
  description: "Client tasks shown by the date they should be assigned to the designer & team",
};

export default function TasksCalendarPage() {
  return <ClientWorkCalendar />;
}

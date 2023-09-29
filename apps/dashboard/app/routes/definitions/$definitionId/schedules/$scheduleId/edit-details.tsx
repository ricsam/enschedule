import Schedule from "./index";
export * from "./index";
export { loader } from "./index";
export { editDetailsAction as action } from "~/components/SchedulePage";
export default function EditDetails() {
  return <Schedule editDetails />;
}

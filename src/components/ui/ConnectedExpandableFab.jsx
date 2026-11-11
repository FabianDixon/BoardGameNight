import ExpandableFab from "./ExpandableFab";
import { useContextualQuickAction } from "./contextualQuickAction";

export default function ConnectedExpandableFab(props) {
  const contextualAction = useContextualQuickAction();
  return <ExpandableFab {...props} contextualAction={contextualAction} />;
}

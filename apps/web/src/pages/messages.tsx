import { AuthGate } from './AuthGate';
import { MessagesPage } from '../features/messages/page';
export default function Messages() {
  return (
    <AuthGate>
      <MessagesPage />
    </AuthGate>
  );
}

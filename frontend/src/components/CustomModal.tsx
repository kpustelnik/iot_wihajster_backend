import { Modal, Box } from "@mui/material";

export default function CustomModal(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'auto',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 24,
        p: 1
      }}>
        <Box sx={{
          maxHeight: '80vh',
          overflowY: 'auto',
          minWidth: 400,
          p: 2
        }}>
          {props.children}
        </Box>
      </Box>
    </Modal>
  );
}
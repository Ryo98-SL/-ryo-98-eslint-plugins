import {Modal} from "../modal.tsx";
import { useCallback } from "react";


const MyFc = () => {

    
    const handleSimpleFcDispose = useCallback<(Parameters<typeof SimpleFc>[0]["onDispose"]) & Function>(() => {
        console.log('Dispose');
    }, []);
    
    const handleModalClose = useCallback<(Parameters<typeof Modal>[0]["onClose"]) & Function>(() => { console.log('Modal closed'); }, []);
    return <>
        <SimpleFc onDispose={handleSimpleFcDispose} />

        <Modal pattern={ModalPattern}  onClose={handleModalClose }/>
    </>
}


type ByAlias = { pop?: { count: number}, onDispose?: () => void }

interface ByInterface { pop?: { count: number, onDispose?: () => void} }

const SimpleFc: React.FC<{ pop?: { count: number, }, onDispose?: () => void }> = () => {
    return <div>123</div>
}
const ModalPattern: Parameters<typeof Modal>[0]["pattern"] = /\d/;

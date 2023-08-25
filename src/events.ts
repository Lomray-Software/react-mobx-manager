/**
 * Store manager events
 */
enum Events {
  CREATE_STORE = 'mobx-manager:store-create',
  MOUNT_STORE = 'mobx-manager:store-mount',
  UNMOUNT_STORE = 'mobx-manager:store-unmount',
  DELETE_STORE = 'mobx-manager:store-delete',
}

export default Events;

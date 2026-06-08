package com.hmdm.plugins.deviceinventory.persistence.mapper;

import com.hmdm.plugins.deviceinventory.persistence.domain.DeviceInventoryRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface DeviceInventoryMapper {

    @Select("SELECT id, customerId, deviceId, lastUpdate, apps::text AS apps " +
            "FROM plugin_deviceinventory WHERE deviceId = #{deviceId}")
    DeviceInventoryRecord findByDeviceId(@Param("deviceId") int deviceId);

    @Insert("INSERT INTO plugin_deviceinventory (customerId, deviceId, lastUpdate, apps) " +
            "VALUES (#{customerId}, #{deviceId}, #{lastUpdate}, #{apps}::jsonb)")
    int insertRecord(DeviceInventoryRecord record);

    @Update("UPDATE plugin_deviceinventory SET lastUpdate = #{lastUpdate}, apps = #{apps}::jsonb " +
            "WHERE deviceId = #{deviceId}")
    int updateRecord(DeviceInventoryRecord record);
}

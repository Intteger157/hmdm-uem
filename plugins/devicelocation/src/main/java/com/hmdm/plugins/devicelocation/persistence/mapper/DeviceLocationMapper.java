package com.hmdm.plugins.devicelocation.persistence.mapper;

import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationHistoryRecord;
import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationLatestRecord;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface DeviceLocationMapper {

    @Select("SELECT id, customerId, deviceId, lat, lon, ts, source " +
            "FROM plugin_devicelocation_latest WHERE deviceId = #{deviceId}")
    DeviceLocationLatestRecord findLatestByDeviceId(@Param("deviceId") int deviceId);

    @Insert("INSERT INTO plugin_devicelocation_latest (customerId, deviceId, lat, lon, ts, source) " +
            "VALUES (#{customerId}, #{deviceId}, #{lat}, #{lon}, #{ts}, #{source})")
    int insertLatest(DeviceLocationLatestRecord record);

    @Update("UPDATE plugin_devicelocation_latest SET lat = #{lat}, lon = #{lon}, ts = #{ts}, source = #{source} " +
            "WHERE deviceId = #{deviceId}")
    int updateLatest(DeviceLocationLatestRecord record);

    @Insert("INSERT INTO plugin_devicelocation_history (customerId, deviceId, lat, lon, ts, source) " +
            "VALUES (#{customerId}, #{deviceId}, #{lat}, #{lon}, #{ts}, #{source})")
    int insertHistory(DeviceLocationHistoryRecord record);

    @Select("SELECT lat, lon, ts, source FROM plugin_devicelocation_history " +
            "WHERE deviceId = #{deviceId} ORDER BY ts DESC LIMIT #{limit}")
    List<DeviceLocationHistoryRecord> findHistory(@Param("deviceId") int deviceId, @Param("limit") int limit);

    @Delete("DELETE FROM plugin_devicelocation_history WHERE ts < #{olderThan}")
    int purgeHistory(@Param("olderThan") long olderThan);
}
